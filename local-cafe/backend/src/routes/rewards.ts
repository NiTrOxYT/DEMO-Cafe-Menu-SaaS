import { Router, Request, Response } from "express";
import { query } from "../db/index.js";
import bcrypt from "bcryptjs";

const router = Router();

// Enroll in Rewards Club
router.post("/enroll", async (req: Request, res: Response) => {
  try {
    const { name, email, phone, pin } = req.body || {};
    if (!name || (!email && !phone)) {
      res.status(400).json({ error: "Name and at least an email or phone number are required." });
      return;
    }

    let pinHash = null;
    if (pin && typeof pin === "string") {
      pinHash = await bcrypt.hash(pin, 10);
    }

    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanPhone = phone ? String(phone).trim() : null;

    // Check existing
    const existing = await query(
      "SELECT * FROM rewards_users WHERE ($1::text IS NOT NULL AND email = $1) OR ($2::text IS NOT NULL AND phone = $2)",
      [cleanEmail, cleanPhone]
    );

    if (existing.rows.length > 0) {
      res.json(existing.rows[0]);
      return;
    }

    const result = await query(
      `INSERT INTO rewards_users (
        name, email, phone, pin_hash, stars, total_visits, reward_available, rewards_claimed, created_at
      ) VALUES ($1, $2, $3, $4, 0, 1, false, 0, NOW())
      RETURNING id, name, email, phone, stars, total_visits, reward_available, rewards_claimed, created_at`,
      [name.trim(), cleanEmail, cleanPhone, pinHash]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to enroll in rewards club", details: err.message });
  }
});

// Login / Verify Rewards Member
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { identifier, pin } = req.body || {};
    if (!identifier) {
      res.status(400).json({ error: "Phone number or email is required." });
      return;
    }

    const cleanIdentifier = String(identifier).trim().toLowerCase();
    const result = await query(
      "SELECT * FROM rewards_users WHERE email = $1 OR phone = $1",
      [cleanIdentifier]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Rewards account not found." });
      return;
    }

    const user = result.rows[0];

    // If account has a PIN set and user provided a PIN, verify it
    if (user.pin_hash && pin) {
      const match = await bcrypt.compare(String(pin), user.pin_hash);
      if (!match) {
        res.status(401).json({ error: "Incorrect 4-digit PIN." });
        return;
      }
    }

    delete user.pin_hash;
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: "Rewards login failed", details: err.message });
  }
});

// Get Member by identifier (email or phone)
router.get("/me", async (req: Request, res: Response) => {
  try {
    const { identifier } = req.query;
    if (!identifier) {
      res.status(400).json({ error: "Identifier parameter is required." });
      return;
    }

    const clean = String(identifier).trim().toLowerCase();
    const result = await query(
      "SELECT id, name, email, phone, stars, total_visits, reward_available, rewards_claimed, last_star_date, last_visit_date, created_at FROM rewards_users WHERE email = $1 OR phone = $1",
      [clean]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Member not found." });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch rewards user", details: err.message });
  }
});

// Claim Reward
router.post("/claim", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body || {};
    if (!userId) {
      res.status(400).json({ error: "userId is required." });
      return;
    }

    const result = await query(
      `UPDATE rewards_users SET
        stars = 0,
        reward_available = false,
        rewards_claimed = COALESCE(rewards_claimed, 0) + 1
       WHERE id = $1
       RETURNING id, name, email, phone, stars, total_visits, reward_available, rewards_claimed`,
      [Number(userId)]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to claim reward", details: err.message });
  }
});

export default router;

