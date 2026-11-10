import { Router, Request, Response } from "express";
import crypto from "crypto";
import { query, pool } from "../db/index.js";
import {
  generateOrderAccessToken,
  verifyOrderAccessToken,
  hashGuestToken,
} from "../lib/tokens.js";
import { verifyAdminToken } from "../lib/auth.js";
import {
  broadcastOrderCreated,
  broadcastOrderUpdated,
  broadcastOrderStatusChanged,
  broadcastOrderDeleted,
} from "../socket.js";
import { validateOfferCode, calculateBestEligibleOffer } from "./offers.js";

const router = Router();

// Helper to check if request is from authenticated admin
function isAdminRequest(req: Request): boolean {
  const token = req.cookies?.admin_session || req.headers.authorization?.replace(/^Bearer\s+/, "");
  if (!token) return false;
  const payload = verifyAdminToken(token);
  return payload?.role === "admin";
}

// GET /api/orders (Admin only - returns all orders with child order_items)
router.get("/orders", async (req: Request, res: Response) => {
  try {
    if (!isAdminRequest(req)) {
      res.status(401).json({ error: "Unauthorized access to order board" });
      return;
    }

    const ordersRes = await query(`
      SELECT 
        o.id,
        o.cafe_id,
        o.table_id,
        o.table_number,
        o.customer_name,
        o.customer_phone,
        o.subtotal,
        o.discount,
        o.promo_code,
        o.offer_id,
        o.tax,
        o.total,
        o.status,
        o.is_active,
        o.is_paid,
        o.updated,
        o.is_updated,
        o.latest_added_items,
        o.whatsapp_sent,
        o.notes,
        o.session_id,
        o.guest_member_id,
        m.guest_name,
        s.status AS session_status,
        COALESCE(s.is_paid, false) AS session_is_paid,
        o.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'order_id', oi.order_id,
              'menu_item_id', oi.menu_item_id,
              'item_name', oi.item_name,
              'quantity', oi.quantity,
              'price', oi.price,
              'created_at', oi.created_at
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS order_items
      FROM orders o
      LEFT JOIN table_session_members m ON o.guest_member_id = m.id
      LEFT JOIN table_sessions s ON o.session_id = s.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id, m.guest_name, s.status, s.is_paid
      ORDER BY o.created_at DESC
    `);

    res.json(ordersRes.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch orders", details: err.message });
  }
});

// GET /api/orders/:id (Customer with capability token, session member, or Admin)
router.get("/orders/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const orderToken = (req.headers["x-order-token"] as string) || (req.query.token as string);
    const guestToken = (req.headers["x-guest-token"] as string) || (req.query.guestToken as string);

    const ordersRes = await query(`
      SELECT 
        o.id,
        o.cafe_id,
        o.table_id,
        o.table_number,
        o.customer_name,
        o.customer_phone,
        o.subtotal,
        o.discount,
        o.promo_code,
        o.offer_id,
        o.tax,
        o.total,
        o.status,
        o.is_active,
        o.is_paid,
        o.updated,
        o.is_updated,
        o.latest_added_items,
        o.whatsapp_sent,
        o.notes,
        o.session_id,
        o.guest_member_id,
        o.order_access_token_hash,
        o.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'order_id', oi.order_id,
              'menu_item_id', oi.menu_item_id,
              'item_name', oi.item_name,
              'quantity', oi.quantity,
              'price', oi.price,
              'created_at', oi.created_at
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS order_items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1
      GROUP BY o.id
    `, [id]);

    if (ordersRes.rows.length === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const order = ordersRes.rows[0];

    // Authorization: Admin session OR valid order capability token OR table session member
    const isAdmin = isAdminRequest(req);
    const hasValidToken = verifyOrderAccessToken(orderToken, order.order_access_token_hash);

    let isSessionMember = false;
    if (guestToken && order.session_id) {
      const hash = hashGuestToken(guestToken);
      const memberCheck = await query(
        `SELECT id FROM table_session_members
         WHERE session_id = $1 AND guest_token_hash = $2`,
        [order.session_id, hash]
      );
      if (memberCheck.rows.length > 0) {
        isSessionMember = true;
      }
    }

    if (!isAdmin && !hasValidToken && !isSessionMember) {
      res.status(403).json({ error: "Access denied. Valid order capability or session membership required." });
      return;
    }

    // Do not leak token hash in response
    delete order.order_access_token_hash;
    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch order", details: err.message });
  }
});

// In-memory cache for idempotency keys (stores created order payload and canonical hash for identical key retries)
const idempotencyKeyCache = new Map<string, { order: any; payloadHash: string; timestamp: number }>();

// Periodic cleanup of entries older than 24 hours
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of idempotencyKeyCache.entries()) {
    if (now - val.timestamp > 86400000) {
      idempotencyKeyCache.delete(key);
    }
  }
}, 60000).unref?.();

// Canonical payload hash derivation for idempotency validation
export function computeCanonicalPayloadHash(payload: {
  sessionId?: number | null;
  guestMemberId?: number | null;
  tableNumber?: string | number | null;
  items: Array<{
    menuItemId?: number | null;
    menu_item_id?: number | null;
    name?: string | null;
    item_name?: string | null;
    quantity: number | string;
    price: number | string;
  }>;
  notes?: string | null;
  subtotal?: number | string | null;
  discount?: number | string | null;
  promoCode?: string | null;
  tax?: number | string | null;
  total?: number | string | null;
}): string {
  const normalizedItems = [...(payload.items || [])]
    .map((item) => {
      const id =
        item.menuItemId !== undefined && item.menuItemId !== null
          ? Number(item.menuItemId)
          : item.menu_item_id !== undefined && item.menu_item_id !== null
          ? Number(item.menu_item_id)
          : null;
      const name = (item.name ?? item.item_name ?? "").trim().toLowerCase();
      const qty = Number(item.quantity) || 1;
      const price = Number(Number(item.price || 0).toFixed(2));
      return { id, name, qty, price };
    })
    .sort((a, b) => {
      if (a.id !== null && b.id !== null) {
        if (a.id !== b.id) return a.id - b.id;
      } else if (a.id !== null) {
        return -1;
      } else if (b.id !== null) {
        return 1;
      }
      if (a.name !== b.name) return a.name.localeCompare(b.name);
      if (a.price !== b.price) return a.price - b.price;
      return a.qty - b.qty;
    });

  const canonicalObj = {
    sessionId: payload.sessionId ? Number(payload.sessionId) : null,
    guestMemberId: payload.guestMemberId ? Number(payload.guestMemberId) : null,
    tableNumber: String(payload.tableNumber || "1"),
    items: normalizedItems,
    notes: (payload.notes || "").trim(),
    subtotal: Number(Number(payload.subtotal || 0).toFixed(2)),
    discount: Number(Number(payload.discount || 0).toFixed(2)),
    promoCode: (payload.promoCode || "").trim().toUpperCase(),
    tax: Number(Number(payload.tax || 0).toFixed(2)),
    total: Number(Number(payload.total || 0).toFixed(2)),
  };

  return crypto.createHash("sha256").update(JSON.stringify(canonicalObj)).digest("hex");
}

// POST /api/orders (Create new independent order + line items; links to session if guestToken provided)
router.post("/orders", async (req: Request, res: Response) => {
  const client = await pool.connect();
  let incomingPayloadHash: string | null = null;
  try {
    const {
      tableNumber,
      tableId,
      items,
      notes,
      customerName,
      customerPhone,
      subtotal,
      discount,
      promoCode,
      offerId,
      tax = 0,
      total,
      cafeId = 1,
      sessionId: bodySessionId,
      idempotencyKey: bodyIdempKey,
    } = req.body || {};

    const guestToken = (req.headers["x-guest-token"] as string) || (req.body?.guestToken as string);
    const idempotencyKey = ((req.headers["x-idempotency-key"] as string) || bodyIdempKey || "").trim();

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Order must contain at least one item." });
      return;
    }

    let resolvedSessionId: number | null = null;
    let resolvedGuestMemberId: number | null = null;
    let resolvedTableNumber = tableNumber ? String(tableNumber).trim() : (tableId ? String(tableId).trim() : null);

    // If explicit sessionId is provided in request body
    if (bodySessionId) {
      const sessRes = await client.query(
        `SELECT id, table_number, status FROM table_sessions WHERE id = $1`,
        [Number(bodySessionId)]
      );
      if (sessRes.rows.length === 0) {
        res.status(404).json({ error: "Specified table session does not exist" });
        return;
      }
      if (sessRes.rows[0].status !== "active") {
        res.status(403).json({ error: "This table session has finished and can no longer accept orders." });
        return;
      }
      resolvedSessionId = sessRes.rows[0].id;
      resolvedTableNumber = sessRes.rows[0].table_number;
    }

    // If guest token is provided, verify active session membership
    if (guestToken) {
      const hash = hashGuestToken(guestToken);
      const memberRes = await client.query(
        `SELECT m.id, m.session_id, s.table_number, s.status
         FROM table_session_members m
         JOIN table_sessions s ON m.session_id = s.id
         WHERE m.guest_token_hash = $1`,
        [hash]
      );

      if (memberRes.rows.length === 0) {
        res.status(401).json({ error: "Invalid guest session token" });
        return;
      }

      const member = memberRes.rows[0];
      if (member.status !== "active") {
        res.status(403).json({ error: "This table session has finished and can no longer accept orders." });
        return;
      }

      resolvedSessionId = member.session_id;
      resolvedGuestMemberId = member.id;
      resolvedTableNumber = member.table_number;
    } else if (!resolvedSessionId && resolvedTableNumber) {
      // If no guest token but table has an active session, link order to the active session ID
      const activeSessionRes = await client.query(
        `SELECT id FROM table_sessions WHERE table_number = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
        [resolvedTableNumber]
      );
      if (activeSessionRes.rows.length > 0) {
        resolvedSessionId = activeSessionRes.rows[0].id;
      }
    }

    // Enforce that table service requires a valid table number or active table session
    if (!resolvedTableNumber && !resolvedSessionId) {
      res.status(400).json({
        error: "Table service requires a valid table session. Please scan your table QR code to order.",
        code: "TABLE_REQUIRED",
      });
      return;
    }

    const calculatedSubtotal = Number(subtotal) || items.reduce((acc: number, item: any) => acc + (Number(item.price) * (item.quantity || 1)), 0);

    let appliedDiscount = 0;
    let appliedPromoCode: string | null = null;
    let appliedOfferId: number | null = null;

    // Automatically evaluate active, eligible offers and apply the best single discount
    const autoEvaluation = await calculateBestEligibleOffer(calculatedSubtotal, items);
    if (autoEvaluation.bestOffer && autoEvaluation.discountAmount > 0) {
      appliedDiscount = autoEvaluation.discountAmount;
      appliedOfferId = autoEvaluation.bestOffer.id;
      appliedPromoCode = autoEvaluation.bestOffer.code || null;
    } else if (promoCode) {
      // Fallback for legacy promo-code requests
      const offerValidation = await validateOfferCode(promoCode, calculatedSubtotal, items);
      if (!offerValidation.valid) {
        res.status(400).json({ error: offerValidation.error || "Invalid promo code" });
        return;
      }
      appliedDiscount = Number(offerValidation.discountAmount) || 0;
      appliedPromoCode = String(promoCode).trim().toUpperCase();
      appliedOfferId = offerValidation.offer?.id || null;
    } else if (discount) {
      appliedDiscount = Math.min(calculatedSubtotal, Number(discount) || 0);
      if (offerId) appliedOfferId = Number(offerId);
    }

    const calculatedTotal = Math.max(0, Math.round((calculatedSubtotal - appliedDiscount + Number(tax)) * 100) / 100);

    // Derive canonical hash of the full checkout payload (session/member, items, quantities, prices, notes, totals)
    incomingPayloadHash = computeCanonicalPayloadHash({
      sessionId: resolvedSessionId,
      guestMemberId: resolvedGuestMemberId,
      tableNumber: resolvedTableNumber,
      items,
      notes: notes || null,
      subtotal: calculatedSubtotal,
      discount: appliedDiscount,
      promoCode: appliedPromoCode,
      tax: Number(tax) || 0,
      total: calculatedTotal,
    });

    // 1. Idempotency Key check: if the exact same submission key is retried, return existing order
    if (idempotencyKey) {
      const cached = idempotencyKeyCache.get(idempotencyKey);
      let existingOrder = cached?.order;
      let existingPayloadHash: string | undefined = cached?.payloadHash;

      if (!existingOrder) {
        // Check DB for order previously created with this idempotency key
        const existingRes = await client.query(
          `SELECT 
            o.id,
            o.cafe_id,
            o.table_id,
            o.table_number,
            o.customer_name,
            o.customer_phone,
            o.subtotal,
            o.discount,
            o.promo_code,
            o.offer_id,
            o.tax,
            o.total,
            o.status,
            o.is_active,
            o.is_paid,
            o.updated,
            o.is_updated,
            o.notes,
            o.session_id,
            o.guest_member_id,
            o.idempotency_key,
            o.idempotency_payload_hash,
            o.created_at,
            m.guest_name,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', oi.id,
                  'order_id', oi.order_id,
                  'menu_item_id', oi.menu_item_id,
                  'item_name', oi.item_name,
                  'quantity', oi.quantity,
                  'price', oi.price,
                  'created_at', oi.created_at
                )
              ) FILTER (WHERE oi.id IS NOT NULL),
              '[]'
            ) AS order_items
          FROM orders o
          LEFT JOIN table_session_members m ON o.guest_member_id = m.id
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.idempotency_key = $1
          GROUP BY o.id, m.guest_name`,
          [idempotencyKey]
        );

        if (existingRes.rows.length > 0) {
          existingOrder = existingRes.rows[0];
          existingPayloadHash =
            (existingOrder.idempotency_payload_hash as string) ||
            computeCanonicalPayloadHash({
              sessionId: existingOrder.session_id,
              guestMemberId: existingOrder.guest_member_id,
              tableNumber: existingOrder.table_number,
              items: existingOrder.order_items,
              notes: existingOrder.notes,
              subtotal: Number(existingOrder.subtotal),
              discount: Number(existingOrder.discount || 0),
              promoCode: existingOrder.promo_code || null,
              tax: Number(existingOrder.tax),
              total: Number(existingOrder.total),
            });
          idempotencyKeyCache.set(idempotencyKey, {
            order: existingOrder,
            payloadHash: existingPayloadHash,
            timestamp: Date.now(),
          });
        }
      }

      if (existingOrder) {
        if (!existingPayloadHash) {
          existingPayloadHash = computeCanonicalPayloadHash({
            sessionId: existingOrder.session_id,
            guestMemberId: existingOrder.guest_member_id,
            tableNumber: existingOrder.table_number,
            items: existingOrder.order_items,
            notes: existingOrder.notes,
            subtotal: Number(existingOrder.subtotal),
            discount: Number(existingOrder.discount || 0),
            promoCode: existingOrder.promo_code || null,
            tax: Number(existingOrder.tax),
            total: Number(existingOrder.total),
          });
        }

        // Return 409 Conflict if same key is reused with ANY different payload
        if (incomingPayloadHash !== existingPayloadHash) {
          res.status(409).json({
            error: "Idempotency key was already used with a different order payload.",
          });
          return;
        }

        // Return original order on matching retry
        res.status(200).json(existingOrder);
        return;
      }
    }

    const { token: plainToken, hash: tokenHash } = generateOrderAccessToken();

    await client.query("BEGIN");

    // 1. Create parent order with idempotency_key and idempotency_payload_hash
    const orderRes = await client.query(
      `INSERT INTO orders (
        cafe_id, table_id, table_number, customer_name, customer_phone,
        subtotal, discount, promo_code, offer_id, tax, total, status, is_active, is_paid, is_updated,
        notes, session_id, guest_member_id, order_access_token_hash,
        idempotency_key, idempotency_payload_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', true, false, false, $12, $13, $14, $15, $16, $17, NOW())
      RETURNING *`,
      [
        Number(cafeId) || 1,
        tableId ? Number(tableId) : (resolvedTableNumber ? Number(resolvedTableNumber) : null),
        resolvedTableNumber,
        customerName || null,
        customerPhone || null,
        calculatedSubtotal,
        appliedDiscount,
        appliedPromoCode,
        appliedOfferId,
        Number(tax) || 0,
        calculatedTotal,
        notes || null,
        resolvedSessionId,
        resolvedGuestMemberId,
        tokenHash,
        idempotencyKey || null,
        idempotencyKey ? incomingPayloadHash : null,
      ]
    );

    const order = orderRes.rows[0];

    // 2. Insert line items
    const insertedItems: any[] = [];
    for (const item of items) {
      const itemRes = await client.query(
        `INSERT INTO order_items (
          order_id, menu_item_id, item_name, quantity, price, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *`,
        [
          order.id,
          item.menuItemId || item.menu_item_id || null,
          item.name || item.item_name || "Item",
          Number(item.quantity) || 1,
          Number(item.price) || 0,
        ]
      );
      insertedItems.push(itemRes.rows[0]);
    }

    await client.query("COMMIT");

    order.order_items = insertedItems;

    // Broadcast over Socket.IO to admin kitchen board and table session room
    broadcastOrderCreated(order);

    // Return order with plain capability token for customer storage
    delete order.order_access_token_hash;
    const responsePayload = {
      ...order,
      orderAccessToken: plainToken,
    };

    // Cache order by idempotency key for exact retries
    if (idempotencyKey) {
      idempotencyKeyCache.set(idempotencyKey, {
        order: responsePayload,
        payloadHash: incomingPayloadHash,
        timestamp: Date.now(),
      });
    }

    res.status(201).json(responsePayload);
  } catch (err: any) {
    await client.query("ROLLBACK");

    // If concurrent retry hit unique constraint on idempotency_key, return the existing order
    const idempotencyKey = ((req.headers["x-idempotency-key"] as string) || req.body?.idempotencyKey || "").trim();
    if (err.code === "23505" && idempotencyKey) {
      const existingRes = await query(
        `SELECT 
          o.id,
          o.cafe_id,
          o.table_id,
          o.table_number,
          o.customer_name,
          o.customer_phone,
          o.subtotal,
          o.discount,
          o.promo_code,
          o.offer_id,
          o.tax,
          o.total,
          o.status,
          o.is_active,
          o.is_paid,
          o.updated,
          o.is_updated,
          o.notes,
          o.session_id,
          o.guest_member_id,
          o.idempotency_key,
          o.idempotency_payload_hash,
          o.created_at,
          m.guest_name,
          COALESCE(
            json_agg(
              json_build_object(
                'id', oi.id,
                'order_id', oi.order_id,
                'menu_item_id', oi.menu_item_id,
                'item_name', oi.item_name,
                'quantity', oi.quantity,
                'price', oi.price,
                'created_at', oi.created_at
              )
            ) FILTER (WHERE oi.id IS NOT NULL),
            '[]'
          ) AS order_items
        FROM orders o
        LEFT JOIN table_session_members m ON o.guest_member_id = m.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.idempotency_key = $1
        GROUP BY o.id, m.guest_name`,
        [idempotencyKey]
      );
      if (existingRes.rows.length > 0) {
        const existingOrder = existingRes.rows[0];
        const existingPayloadHash = existingOrder.idempotency_payload_hash || computeCanonicalPayloadHash({
          sessionId: existingOrder.session_id,
          guestMemberId: existingOrder.guest_member_id,
          tableNumber: existingOrder.table_number,
          items: existingOrder.order_items,
          notes: existingOrder.notes,
          subtotal: Number(existingOrder.subtotal),
          discount: Number(existingOrder.discount || 0),
          promoCode: existingOrder.promo_code || null,
          tax: Number(existingOrder.tax),
          total: Number(existingOrder.total),
        });

        if (incomingPayloadHash && existingPayloadHash !== incomingPayloadHash) {
          res.status(409).json({
            error: "Idempotency key was already used with a different order payload.",
          });
          return;
        }

        res.status(200).json(existingOrder);
        return;
      }
    }

    res.status(500).json({ error: "Failed to create order", details: err.message });
  } finally {
    client.release();
  }
});

// POST /api/orders/:id/append (Append items to active order)
router.post("/orders/:id/append", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const orderId = parseInt(String(req.params.id), 10);
    const { items } = req.body || {};
    const orderToken = (req.headers["x-order-token"] as string) || (req.query.token as string);
    const guestToken = (req.headers["x-guest-token"] as string) || (req.body?.guestToken as string);

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "At least one item is required to append." });
      return;
    }

    const checkRes = await query("SELECT * FROM orders WHERE id = $1", [orderId]);
    if (checkRes.rows.length === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const existingOrder = checkRes.rows[0];

    // Authorization: Admin OR matching order capability token OR table session member
    let isAuthorized = isAdminRequest(req) || verifyOrderAccessToken(orderToken, existingOrder.order_access_token_hash);

    if (!isAuthorized && guestToken && existingOrder.session_id) {
      const hash = hashGuestToken(guestToken);
      const memberRes = await query(
        `SELECT m.id, s.status FROM table_session_members m
         JOIN table_sessions s ON m.session_id = s.id
         WHERE m.session_id = $1 AND m.guest_token_hash = $2 AND s.status = 'active'`,
        [existingOrder.session_id, hash]
      );
      if (memberRes.rows.length > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      res.status(403).json({ error: "Access denied. Valid order or session credentials required." });
      return;
    }

    await client.query("BEGIN");

    // 1. Insert newly appended items
    let appendedCost = 0;
    const latestDescriptions: string[] = [];
    const insertedItems: any[] = [];

    for (const item of items) {
      const qty = Number(item.quantity) || 1;
      const price = Number(item.price) || 0;
      appendedCost += (qty * price);
      latestDescriptions.push(`${qty}x ${item.name || item.item_name}`);

      const itemRes = await client.query(
        `INSERT INTO order_items (
          order_id, menu_item_id, item_name, quantity, price, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *`,
        [
          orderId,
          item.menuItemId || item.menu_item_id || null,
          item.name || item.item_name || "Item",
          qty,
          price,
        ]
      );
      insertedItems.push(itemRes.rows[0]);
    }

    // 2. Update order totals and status
    const updatedSubtotal = Number(existingOrder.subtotal) + appendedCost;
    const updatedTotal = Number(existingOrder.total) + appendedCost;
    const newStatus = ["preparing", "ready", "completed"].includes(existingOrder.status)
      ? "pending"
      : existingOrder.status;

    const updateRes = await client.query(
      `UPDATE orders SET
        subtotal = $1,
        total = $2,
        status = $3,
        is_updated = true,
        updated = true,
        latest_added_items = $4
       WHERE id = $5
       RETURNING *`,
      [updatedSubtotal, updatedTotal, newStatus, JSON.stringify(latestDescriptions), orderId]
    );

    // Fetch all order_items
    const allItemsRes = await client.query("SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC", [orderId]);

    await client.query("COMMIT");

    const fullOrder = updateRes.rows[0];
    fullOrder.order_items = allItemsRes.rows;

    // Broadcast realtime update to admin and table session room
    broadcastOrderUpdated(fullOrder);

    delete fullOrder.order_access_token_hash;
    res.json(fullOrder);
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to append to order", details: err.message });
  } finally {
    client.release();
  }
});

// POST /api/orders/:id/cancel (Guests cancel only their own order while pending; or Admin)
router.post("/orders/:id/cancel", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const guestToken = (req.headers["x-guest-token"] as string) || (req.body?.guestToken as string);
    const isAdmin = isAdminRequest(req);

    const orderRes = await query("SELECT * FROM orders WHERE id = $1", [id]);
    if (orderRes.rows.length === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const order = orderRes.rows[0];

    if (!isAdmin) {
      if (!guestToken) {
        res.status(401).json({ error: "Guest session token required to cancel order" });
        return;
      }

      const hash = hashGuestToken(guestToken);
      const memberRes = await query(
        `SELECT m.id, s.status FROM table_session_members m
         JOIN table_sessions s ON m.session_id = s.id
         WHERE m.guest_token_hash = $1`,
        [hash]
      );

      if (memberRes.rows.length === 0) {
        res.status(403).json({ error: "Invalid guest token" });
        return;
      }

      const member = memberRes.rows[0];

      // Enforce: guests may edit or cancel only their own order while pending
      if (order.guest_member_id !== member.id) {
        res.status(403).json({ error: "You can only cancel your own orders." });
        return;
      }

      if (order.status !== "pending") {
        res.status(400).json({
          error: `Order cannot be cancelled because it is already ${order.status}. Only pending orders can be cancelled.`,
        });
        return;
      }
    }

    const updateRes = await query(
      "UPDATE orders SET status = 'cancelled', is_active = false WHERE id = $1 RETURNING *",
      [id]
    );
    const updatedOrder = updateRes.rows[0];

    broadcastOrderStatusChanged(id, "cancelled", false, false, order.session_id);

    res.json({ success: true, message: "Order cancelled successfully", order: updatedOrder });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to cancel order", details: err.message });
  }
});

// PATCH /api/orders/:id/status (Staff/Admin only controls order status)
router.patch("/orders/:id/status", async (req: Request, res: Response) => {
  try {
    if (!isAdminRequest(req)) {
      res.status(401).json({ error: "Staff/Admin authentication required to update order status" });
      return;
    }

    const id = parseInt(String(req.params.id), 10);
    const { status } = req.body || {};

    if (!status) {
      res.status(400).json({ error: "Status is required." });
      return;
    }

    const allowedStatuses = ["pending", "accepted", "preparing", "ready", "served", "completed", "cancelled"];
    if (!allowedStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status: ${status}. Allowed: ${allowedStatuses.join(", ")}` });
      return;
    }

    // Orders remain active for the table session until session closed or order is cancelled/completed
    const isActive = (status === "cancelled" || status === "completed") ? false : true;

    const updateFields = [
      "status = $1",
      "is_active = $2",
    ];
    const values: any[] = [status, isActive];
    let idx = 3;

    if (req.body?.isPaid !== undefined) {
      updateFields.push(`is_paid = $${idx}`);
      values.push(Boolean(req.body.isPaid));
      idx++;
    } else if (status === "completed") {
      updateFields.push(`is_paid = true`);
    }

    if (status === "preparing") {
      updateFields.push(`is_updated = false`);
      updateFields.push(`latest_added_items = '[]'::jsonb`);
    }

    values.push(id);
    const result = await query(
      `UPDATE orders SET ${updateFields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const order = result.rows[0];

    // Broadcast status change over Socket.IO to admin and session room
    broadcastOrderStatusChanged(id, status, order.is_active, order.is_paid, order.session_id);

    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update order status", details: err.message });
  }
});

// DELETE /api/orders/:id (Admin only)
router.delete("/orders/:id", async (req: Request, res: Response) => {
  try {
    if (!isAdminRequest(req)) {
      res.status(401).json({ error: "Admin authentication required" });
      return;
    }

    const id = parseInt(String(req.params.id), 10);
    const checkRes = await query("SELECT session_id FROM orders WHERE id = $1", [id]);
    const sessionId = checkRes.rows[0]?.session_id;

    const result = await query("DELETE FROM orders WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    broadcastOrderDeleted(id, sessionId);
    res.json({ success: true, message: "Order deleted", id });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete order", details: err.message });
  }
});

export default router;
