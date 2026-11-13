import { Router, Request, Response } from "express";
import crypto from "crypto";
import { query, pool } from "../db/index.js";
import {
  getCafeCoordinates,
  verifyDeviceLocation,
  signCustomerAccessToken,
  setCustomerAccessCookie,
  verifyCustomerAccessToken,
  MAX_DISTANCE_METRES,
  CUSTOMER_ACCESS_COOKIE,
} from "../lib/location.js";

const router = Router();

/**
 * GET /api/customer/location-status
 * Public endpoint for frontend to discover whether the café location gate is configured,
 * and fetch directions destination URL for the Get Directions CTA.
 */
router.get("/customer/location-status", async (_req: Request, res: Response) => {
  try {
    const cafe = await getCafeCoordinates();
    res.json({
      configured: cafe.isConfigured,
      restaurantName: cafe.restaurantName,
      address: cafe.address,
      latitude: cafe.latitude,
      longitude: cafe.longitude,
      maxDistanceMetres: MAX_DISTANCE_METRES,
      directionsUrl: cafe.isConfigured
        ? `https://www.google.com/maps/dir/?api=1&destination=${cafe.latitude},${cafe.longitude}`
        : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get location status", details: err.message });
  }
});

/**
 * POST /api/customer/verify-location
 * Customer location verification for direct menu browsing (without a table QR).
 * Verifies reported device coordinates are within 50 metres. Does NOT store device coordinates.
 */
router.post("/customer/verify-location", async (req: Request, res: Response) => {
  try {
    const { latitude, longitude, accuracy } = req.body || {};

    const locResult = await verifyDeviceLocation(latitude, longitude, accuracy);
    if (!locResult.valid) {
      res.status(403).json({
        success: false,
        reason: locResult.reason,
        message: locResult.message,
        distance: locResult.distance,
        accuracy: locResult.accuracy,
        directionsUrl: locResult.directionsUrl,
      });
      return;
    }

    const token = signCustomerAccessToken(null);
    setCustomerAccessCookie(res, token);

    res.json({
      success: true,
      message: locResult.message,
      distance: locResult.distance,
      token,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Location verification failed", details: err.message });
  }
});

/**
 * POST /api/qr/request-scan-link
 * When a guest scans a reusable printed table QR (?table=N), the client reports location.
 * Once verified within 50 metres, generates a fresh, cryptographically random, opaque,
 * short-lived, single-use scan access token.
 * A later scan for this table invalidates previous UNREDEEMED scan links, without invalidating
 * already-redeemed sessions for guests currently ordering at the table.
 */
router.post("/qr/request-scan-link", async (req: Request, res: Response) => {
  const client = await pool.connect();
  let inTransaction = false;

  try {
    const { tableNumber, latitude, longitude, accuracy } = req.body || {};
    const table = String(tableNumber || "").trim();

    if (!table) {
      res.status(400).json({ error: "Table number is required." });
      return;
    }

    // 1. Enforce location gate: Must be within 50 metres of café
    const locResult = await verifyDeviceLocation(latitude, longitude, accuracy);
    if (!locResult.valid) {
      res.status(403).json({
        success: false,
        reason: locResult.reason,
        message: locResult.message,
        distance: locResult.distance,
        accuracy: locResult.accuracy,
        directionsUrl: locResult.directionsUrl,
      });
      return;
    }

    // 2. Generate cryptographically random 32-byte opaque token
    const scanToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(scanToken).digest("hex");

    await client.query("BEGIN");
    inTransaction = true;

    // 3. Invalidate previous UNREDEEMED scan links for this table
    // (Notice: does NOT invalidate already-redeemed sessions for people currently ordering!)
    await client.query(
      `UPDATE table_scan_links
       SET is_superseded = true
       WHERE table_number = $1 AND redeemed_at IS NULL AND is_superseded = false`,
      [table]
    );

    // 4. Insert new single-use scan link with 5-minute expiry
    const insertRes = await client.query(
      `INSERT INTO table_scan_links (
         table_number, token_hash, is_superseded, expires_at, created_at
       ) VALUES ($1, $2, false, NOW() + INTERVAL '5 minutes', NOW())
       RETURNING id, expires_at`,
      [table, tokenHash]
    );

    await client.query("COMMIT");
    inTransaction = false;

    res.json({
      success: true,
      tableNumber: table,
      scanToken,
      scanUrl: `/?scan=${scanToken}`,
      expiresAt: insertRes.rows[0].expires_at,
    });
  } catch (err: any) {
    if (inTransaction) await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: "Failed to generate scan link", details: err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/qr/redeem-scan-link
 * Atomically redeems a single-use scan link token.
 * Rejects expired, replayed, superseded, or out-of-range links.
 * On redemption, establishes customer access and returns verified table number.
 */
router.post("/api/qr/redeem-scan-link", async (req: Request, res: Response) => {
  // Alias endpoint handler
  return handleRedeem(req, res);
});
router.post("/qr/redeem-scan-link", async (req: Request, res: Response) => {
  return handleRedeem(req, res);
});

async function handleRedeem(req: Request, res: Response) {
  const client = await pool.connect();
  let inTransaction = false;

  try {
    const { token, latitude, longitude, accuracy } = req.body || {};
    const rawToken = String(token || "").trim();

    if (!rawToken) {
      res.status(400).json({ error: "Scan token is required." });
      return;
    }

    // Optional location re-verification if coordinates are passed during redemption
    if (latitude !== undefined && longitude !== undefined) {
      const locResult = await verifyDeviceLocation(latitude, longitude, accuracy);
      if (!locResult.valid) {
        res.status(403).json({
          error: "OUT_OF_RANGE",
          reason: locResult.reason,
          message: locResult.message,
          directionsUrl: locResult.directionsUrl,
        });
        return;
      }
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    await client.query("BEGIN");
    inTransaction = true;

    // Atomic select for update
    const linkRes = await client.query(
      `SELECT id, table_number, is_superseded, redeemed_at, expires_at
       FROM table_scan_links
       WHERE token_hash = $1
       FOR UPDATE`,
      [tokenHash]
    );

    if (linkRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(403).json({
        error: "INVALID_SCAN_LINK",
        message: "This scan link is invalid. Please scan the QR code on your table again.",
      });
      return;
    }

    const link = linkRes.rows[0];

    // Check if superseded
    if (link.is_superseded) {
      await client.query("ROLLBACK");
      res.status(403).json({
        error: "SUPERSEDED_SCAN_LINK",
        message: "This scan link was superseded by a newer scan. Please scan the QR code on your table again.",
      });
      return;
    }

    // Check if already redeemed
    if (link.redeemed_at !== null) {
      await client.query("ROLLBACK");
      res.status(403).json({
        error: "REPLAYED_SCAN_LINK",
        message: "This scan link has already been used. Please scan the QR code on your table again.",
      });
      return;
    }

    // Check if expired
    const isExpired = new Date(link.expires_at).getTime() < Date.now();
    if (isExpired) {
      await client.query("ROLLBACK");
      res.status(403).json({
        error: "EXPIRED_SCAN_LINK",
        message: "This scan link has expired. Please scan the QR code on your table again.",
      });
      return;
    }

    // Mark redeemed atomically
    await client.query(
      `UPDATE table_scan_links SET redeemed_at = NOW() WHERE id = $1`,
      [link.id]
    );

    await client.query("COMMIT");
    inTransaction = false;

    // Issue verified customer access token for this table
    const customerToken = signCustomerAccessToken(link.table_number);
    setCustomerAccessCookie(res, customerToken);

    res.json({
      success: true,
      tableNumber: link.table_number,
      token: customerToken,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });
  } catch (err: any) {
    if (inTransaction) await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: "Failed to redeem scan link", details: err.message });
  } finally {
    client.release();
  }
}

export default router;

