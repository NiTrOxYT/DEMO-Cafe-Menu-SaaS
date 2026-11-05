import { Router, Request, Response } from "express";
import { query } from "../db/index.js";
import { hashPassword, verifyPassword, signAdminToken, setAdminCookie, clearAdminCookie, requireAdmin } from "../lib/auth.js";

const router = Router();

// Check if any admin user exists in the database
router.get("/status", async (_req: Request, res: Response) => {
  try {
    const result = await query("SELECT count(*) AS count FROM admin_users");
    const count = parseInt(result.rows[0]?.count || "0", 10);
    res.json({
      initialized: count > 0,
      adminCount: count,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to check setup status", details: err.message });
  }
});

// Secure First-Run Setup (Only callable when 0 admin users exist)
router.post("/first-run-setup", async (req: Request, res: Response) => {
  try {
    const check = await query("SELECT count(*) AS count FROM admin_users");
    const existingCount = parseInt(check.rows[0]?.count || "0", 10);
    if (existingCount > 0) {
      res.status(403).json({ error: "System is already initialized with an administrator." });
      return;
    }

    const { email, password, restaurantName } = req.body || {};
    if (!email || !password || typeof password !== "string" || password.length < 6) {
      res.status(400).json({ error: "Valid email and a password of at least 6 characters are required." });
      return;
    }

    const passwordHash = await hashPassword(password);

    // Atomic setup transaction
    const client = await (await import("../db/index.js")).pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Create master admin
      const adminRes = await client.query(
        "INSERT INTO admin_users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at",
        [email.trim().toLowerCase(), passwordHash]
      );
      const admin = adminRes.rows[0];

      // 2. Ensure default café exists
      const cafeCheck = await client.query("SELECT id FROM cafes WHERE id = 1");
      if (cafeCheck.rows.length === 0) {
        await client.query(
          "INSERT INTO cafes (id, name, slug) VALUES (1, $1, 'default') ON CONFLICT DO NOTHING",
          [restaurantName || "The Golden Brew"]
        );
      }

      // 3. Ensure default restaurant settings exists
      const settingsCheck = await client.query("SELECT id FROM restaurant_settings LIMIT 1");
      if (settingsCheck.rows.length === 0) {
        await client.query(
          "INSERT INTO restaurant_settings (restaurant_name) VALUES ($1)",
          [restaurantName || "The Golden Brew"]
        );
      }

      // 4. Provision default tables 1 through 20
      for (let t = 1; t <= 20; t++) {
        await client.query(
          "INSERT INTO restaurant_tables (cafe_id, table_number) VALUES (1, $1) ON CONFLICT DO NOTHING",
          [t]
        );
      }

      await client.query("COMMIT");

      // Issue signed session cookie
      const token = signAdminToken({ id: admin.id, email: admin.email });
      setAdminCookie(res, token);

      res.status(201).json({
        success: true,
        message: "Administrator account and local café infrastructure successfully initialized.",
        user: { id: admin.id, email: admin.email },
      });
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to perform first-run setup", details: err.message });
  }
});

// Admin Login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const result = await query(
      "SELECT id, email, password_hash FROM admin_users WHERE email = $1",
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const admin = result.rows[0];
    const valid = await verifyPassword(password, admin.password_hash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const token = signAdminToken({ id: admin.id, email: admin.email });
    setAdminCookie(res, token);

    res.json({
      success: true,
      user: { id: admin.id, email: admin.email },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Login failed", details: err.message });
  }
});

// Admin Logout
router.post("/logout", (_req: Request, res: Response) => {
  clearAdminCookie(res);
  res.json({ success: true, message: "Logged out" });
});

// Get current logged-in admin
router.get("/me", requireAdmin, (req: Request, res: Response) => {
  res.json({ user: (req as any).admin });
});

export default router;

