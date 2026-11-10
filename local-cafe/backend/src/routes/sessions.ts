import { Router, Request, Response } from "express";
import { query, pool } from "../db/index.js";
import { generateGuestToken, hashGuestToken, verifyGuestToken } from "../lib/tokens.js";
import { verifyAdminToken } from "../lib/auth.js";
import {
  broadcastSessionCreated,
  broadcastSessionUpdated,
  broadcastSessionFinished,
  broadcastSessionClosed,
} from "../socket.js";

const router = Router();

// Helper to check if request is from authenticated admin
function isAdminRequest(req: Request): boolean {
  const token = req.cookies?.admin_session || req.headers.authorization?.replace(/^Bearer\s+/, "");
  if (!token) return false;
  const payload = verifyAdminToken(token);
  return payload?.role === "admin";
}

/**
 * GET /api/tables/:tableNumber/session
 * Inspects whether an active session exists for this table.
 * If guest presents x-guest-token, checks their existing membership.
 */
router.get("/tables/:tableNumber/session", async (req: Request, res: Response) => {
  try {
    const tableNumber = String(req.params.tableNumber).trim();
    const guestToken = (req.headers["x-guest-token"] as string) || (req.query.guestToken as string);

    const sessionRes = await query(
      `SELECT id, cafe_id, table_number, party_size, status, created_at
       FROM table_sessions
       WHERE table_number = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [tableNumber]
    );

    if (sessionRes.rows.length === 0) {
      res.json({ active: false });
      return;
    }

    const session = sessionRes.rows[0];

    // Count existing distinct members
    const membersCountRes = await query(
      "SELECT count(*) AS count FROM table_session_members WHERE session_id = $1",
      [session.id]
    );
    const membersCount = parseInt(membersCountRes.rows[0]?.count || "0", 10);
    const isFull = membersCount >= session.party_size;

    // Check if current guest is already a member
    let isMember = false;
    let memberData: any = null;

    if (guestToken) {
      const hash = hashGuestToken(guestToken);
      const memberRes = await query(
        `SELECT id, session_id, guest_name, is_first_guest, created_at
         FROM table_session_members
         WHERE session_id = $1 AND guest_token_hash = $2`,
        [session.id, hash]
      );
      if (memberRes.rows.length > 0) {
        isMember = true;
        memberData = memberRes.rows[0];
      }
    }

    res.json({
      active: true,
      session: {
        id: session.id,
        tableNumber: session.table_number,
        partySize: session.party_size,
        status: session.status,
        createdAt: session.created_at,
      },
      membersCount,
      isFull,
      isMember,
      member: memberData
        ? {
            id: memberData.id,
            isFirstGuest: memberData.is_first_guest,
            guestName: memberData.guest_name,
          }
        : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to check table session", details: err.message });
  }
});

/**
 * POST /api/tables/:tableNumber/session
 * Creates the active session for a table.
 * First guest chooses party size (1, 2, 3, 4).
 * Backend sets maximum party size and adds first guest immediately.
 */
router.post("/tables/:tableNumber/session", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const tableNumber = String(req.params.tableNumber).trim();
    const { partySize, guestName } = req.body || {};

    const size = parseInt(String(partySize), 10);
    if (![1, 2, 3, 4].includes(size)) {
      res.status(400).json({
        error: "Invalid party size. Allowed choices are exactly: 1, 2, 3, 4.",
      });
      return;
    }

    // Check if an active session already exists (enforced by DB partial unique index as well)
    const existingRes = await client.query(
      "SELECT id, party_size, created_at FROM table_sessions WHERE table_number = $1 AND status = 'active'",
      [tableNumber]
    );

    if (existingRes.rows.length > 0) {
      res.status(409).json({
        error: "An active session already exists for this table",
        session: existingRes.rows[0],
      });
      return;
    }

    await client.query("BEGIN");

    // 1. Create session
    const insertSessionRes = await client.query(
      `INSERT INTO table_sessions (table_number, party_size, status, created_at)
       VALUES ($1, $2, 'active', NOW())
       RETURNING *`,
      [tableNumber, size]
    );
    const session = insertSessionRes.rows[0];

    // 2. Generate first guest credentials
    const { token: plainToken, hash: tokenHash } = generateGuestToken();

    const insertMemberRes = await client.query(
      `INSERT INTO table_session_members (
        session_id, guest_token_hash, guest_name, is_first_guest, created_at
      ) VALUES ($1, $2, $3, true, NOW())
      RETURNING *`,
      [session.id, tokenHash, guestName || "Guest 1"]
    );
    const member = insertMemberRes.rows[0];

    await client.query("COMMIT");

    // Broadcast session creation to admin live board
    broadcastSessionCreated({
      id: session.id,
      tableNumber: session.table_number,
      partySize: session.party_size,
      membersCount: 1,
      status: session.status,
      createdAt: session.created_at,
    });

    res.status(201).json({
      session: {
        id: session.id,
        tableNumber: session.table_number,
        partySize: session.party_size,
        status: session.status,
        createdAt: session.created_at,
      },
      guestToken: plainToken,
      member: {
        id: member.id,
        isFirstGuest: true,
        guestName: member.guest_name,
      },
      membersCount: 1,
    });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to create table session", details: err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/tables/:tableNumber/session/join
 * Joins an existing active session for this table.
 * If current members < party_size, issues new guest credentials and adds to session.
 * If party size reached, rejects with "This table session is full".
 * If already a member (via valid x-guest-token), returns existing credentials without double-counting.
 */
router.post("/tables/:tableNumber/session/join", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const tableNumber = String(req.params.tableNumber).trim();
    const { guestName } = req.body || {};
    const guestToken = (req.headers["x-guest-token"] as string) || (req.body?.guestToken as string);

    const sessionRes = await client.query(
      `SELECT id, table_number, party_size, status, created_at
       FROM table_sessions
       WHERE table_number = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [tableNumber]
    );

    if (sessionRes.rows.length === 0) {
      res.status(404).json({ error: "No active session exists for this table" });
      return;
    }

    const session = sessionRes.rows[0];

    // Check if guest already has a valid membership token for this active session
    if (guestToken) {
      const hash = hashGuestToken(guestToken);
      const existingMemberRes = await client.query(
        `SELECT id, session_id, guest_name, is_first_guest, created_at
         FROM table_session_members
         WHERE session_id = $1 AND guest_token_hash = $2`,
        [session.id, hash]
      );
      if (existingMemberRes.rows.length > 0) {
        const member = existingMemberRes.rows[0];
        const countRes = await client.query(
          "SELECT count(*) as count FROM table_session_members WHERE session_id = $1",
          [session.id]
        );
        res.json({
          session: {
            id: session.id,
            tableNumber: session.table_number,
            partySize: session.party_size,
            status: session.status,
            createdAt: session.created_at,
          },
          guestToken,
          member: {
            id: member.id,
            isFirstGuest: member.is_first_guest,
            guestName: member.guest_name,
          },
          membersCount: parseInt(countRes.rows[0]?.count || "1", 10),
          alreadyMember: true,
        });
        return;
      }
    }

    await client.query("BEGIN");

    // Lock session row to prevent race conditions on simultaneous joins
    const lockRes = await client.query(
      "SELECT id, party_size FROM table_sessions WHERE id = $1 AND status = 'active' FOR UPDATE",
      [session.id]
    );

    if (lockRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Table session is no longer active" });
      return;
    }

    const currentMembersRes = await client.query(
      "SELECT count(*) AS count FROM table_session_members WHERE session_id = $1",
      [session.id]
    );
    const currentMembers = parseInt(currentMembersRes.rows[0]?.count || "0", 10);

    // Strictly enforce capacity
    if (currentMembers >= session.party_size) {
      await client.query("ROLLBACK");
      res.status(403).json({
        error: "This table session is full",
        code: "SESSION_FULL",
        partySize: session.party_size,
        membersCount: currentMembers,
      });
      return;
    }

    // Add new member
    const { token: plainToken, hash: tokenHash } = generateGuestToken();
    const guestNumber = currentMembers + 1;

    const insertMemberRes = await client.query(
      `INSERT INTO table_session_members (
        session_id, guest_token_hash, guest_name, is_first_guest, created_at
      ) VALUES ($1, $2, $3, false, NOW())
      RETURNING *`,
      [session.id, tokenHash, guestName || `Guest ${guestNumber}`]
    );
    const newMember = insertMemberRes.rows[0];

    await client.query("COMMIT");

    const newMembersCount = currentMembers + 1;

    // Broadcast session member update to other guests and admin
    broadcastSessionUpdated({
      id: session.id,
      tableNumber: session.table_number,
      partySize: session.party_size,
      membersCount: newMembersCount,
      status: session.status,
    });

    res.status(200).json({
      session: {
        id: session.id,
        tableNumber: session.table_number,
        partySize: session.party_size,
        status: session.status,
        createdAt: session.created_at,
      },
      guestToken: plainToken,
      member: {
        id: newMember.id,
        isFirstGuest: false,
        guestName: newMember.guest_name,
      },
      membersCount: newMembersCount,
    });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to join table session", details: err.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/sessions/:id/orders
 * Returns all orders placed in this session.
 * Requires valid guest token belonging to this session OR admin credentials.
 * Includes `is_mine: boolean` so guests know which orders are their own.
 */
router.get("/sessions/:id/orders", async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(String(req.params.id), 10);
    const guestToken = (req.headers["x-guest-token"] as string) || (req.query.guestToken as string);
    const isAdmin = isAdminRequest(req);

    // Verify session exists
    const sessionRes = await query("SELECT id, table_number, status FROM table_sessions WHERE id = $1", [sessionId]);
    if (sessionRes.rows.length === 0) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const session = sessionRes.rows[0];

    let currentMemberId: number | null = null;

    if (!isAdmin) {
      if (session.status !== "active") {
        res.status(403).json({ error: "This table session has ended and access is revoked." });
        return;
      }

      if (!guestToken) {
        res.status(401).json({ error: "Guest token required to view session orders" });
        return;
      }

      const hash = hashGuestToken(guestToken);
      const memberRes = await query(
        "SELECT id, session_id FROM table_session_members WHERE session_id = $1 AND guest_token_hash = $2",
        [sessionId, hash]
      );

      if (memberRes.rows.length === 0) {
        res.status(403).json({ error: "Access denied. You are not a member of this table session." });
        return;
      }

      currentMemberId = memberRes.rows[0].id;
    }

    const ordersRes = await query(
      `SELECT 
        o.id,
        o.cafe_id,
        o.table_id,
        o.table_number,
        o.customer_name,
        o.customer_phone,
        o.subtotal,
        o.tax,
        o.total,
        o.status,
        o.is_active,
        o.is_paid,
        o.updated,
        o.is_updated,
        o.latest_added_items,
        o.session_id,
        o.guest_member_id,
        m.guest_name,
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
      LEFT JOIN table_session_members m ON o.guest_member_id = m.id
      WHERE o.session_id = $1
      GROUP BY o.id, m.guest_name
      ORDER BY o.created_at ASC`,
      [sessionId]
    );

    const orders = ordersRes.rows.map((o) => ({
      ...o,
      is_mine: currentMemberId ? o.guest_member_id === currentMemberId : true,
    }));

    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch session orders", details: err.message });
  }
});

/**
 * GET /api/sessions/active
 * Admin only: returns all currently active table sessions with member counts and totals.
 */
router.get("/sessions/active", async (req: Request, res: Response) => {
  try {
    if (!isAdminRequest(req)) {
      res.status(401).json({ error: "Admin authentication required" });
      return;
    }

    // Fix doubled bill: Aggregate members and orders in separate subqueries to prevent Cartesian product
    const result = await query(`
      SELECT 
        s.id,
        s.table_number,
        s.party_size,
        s.status,
        COALESCE(s.is_paid, false) AS is_paid,
        s.created_at,
        COALESCE(m.members_count, 0) AS members_count,
        COALESCE(o.orders_count, 0) AS orders_count,
        COALESCE(o.total_amount, 0) AS total_amount,
        COALESCE(o.unserved_orders_count, 0) AS unserved_orders_count
      FROM table_sessions s
      LEFT JOIN (
        SELECT session_id, COUNT(*) AS members_count
        FROM table_session_members
        GROUP BY session_id
      ) m ON s.id = m.session_id
      LEFT JOIN (
        SELECT 
          session_id, 
          COUNT(*) AS orders_count, 
          COALESCE(SUM(total), 0) AS total_amount,
          COUNT(*) FILTER (WHERE status NOT IN ('served', 'cancelled', 'completed')) AS unserved_orders_count
        FROM orders
        WHERE status != 'cancelled'
        GROUP BY session_id
      ) o ON s.id = o.session_id
      WHERE s.status = 'active'
      ORDER BY s.table_number ASC, s.created_at DESC
    `);

    res.json(
      result.rows.map((r) => ({
        id: r.id,
        tableNumber: r.table_number,
        partySize: r.party_size,
        status: r.status,
        isPaid: Boolean(r.is_paid),
        createdAt: r.created_at,
        membersCount: parseInt(r.members_count || "0", 10),
        ordersCount: parseInt(r.orders_count || "0", 10),
        totalAmount: parseFloat(r.total_amount || "0"),
        unservedOrdersCount: parseInt(r.unserved_orders_count || "0", 10),
      }))
    );
  } catch (err: any) {
    res.status(500).json({ error: "Failed to list active sessions", details: err.message });
  }
});

/**
 * POST /api/sessions/:id/pay
 * Admin confirms payment for a table session.
 * Available only when all session orders are served or cancelled.
 * Marks the session paid, closes it, marks all non-cancelled orders paid/inactive,
 * revokes guest access, and leaves full order history preserved.
 */
router.post("/sessions/:id/pay", async (req: Request, res: Response) => {
  try {
    if (!isAdminRequest(req)) {
      res.status(401).json({ error: "Admin authentication required" });
      return;
    }

    const sessionId = parseInt(String(req.params.id), 10);

    const sessionRes = await query(
      "SELECT * FROM table_sessions WHERE id = $1 AND status = 'active'",
      [sessionId]
    );

    if (sessionRes.rows.length === 0) {
      res.status(404).json({ error: "Active table session not found or already closed" });
      return;
    }

    const session = sessionRes.rows[0];

    // Check if any order is still in kitchen / unserved
    const unservedRes = await query(
      "SELECT id, status FROM orders WHERE session_id = $1 AND status NOT IN ('served', 'cancelled', 'completed')",
      [sessionId]
    );

    if (unservedRes.rows.length > 0) {
      res.status(400).json({
        error: `Cannot mark session as Paid. All orders must be Served or Cancelled before closing the session. Currently ${unservedRes.rows.length} order(s) are in progress.`,
        unservedCount: unservedRes.rows.length,
      });
      return;
    }

    // Mark session as paid and finished
    await query(
      `UPDATE table_sessions
       SET status = 'finished', is_paid = true, finished_at = NOW()
       WHERE id = $1`,
      [sessionId]
    );

    // Mark non-cancelled orders as paid & inactive (orders and item history strictly preserved in DB)
    await query(
      `UPDATE orders
       SET is_paid = true, is_active = false
       WHERE session_id = $1 AND status != 'cancelled'`,
      [sessionId]
    );

    // Broadcast session closed and revoke Socket.IO room members
    broadcastSessionFinished(session.id, session.table_number);

    res.json({
      success: true,
      message: `Table ${session.table_number} session marked as Paid and closed successfully`,
      sessionId: session.id,
      tableNumber: session.table_number,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to mark table session as paid", details: err.message });
  }
});

/**
 * POST /api/sessions/:id/finish
 * Compatible alias for marking session paid / closing table session.
 */
router.post("/sessions/:id/finish", async (req: Request, res: Response) => {
  try {
    if (!isAdminRequest(req)) {
      res.status(401).json({ error: "Admin authentication required" });
      return;
    }

    const sessionId = parseInt(String(req.params.id), 10);

    const sessionRes = await query(
      "SELECT * FROM table_sessions WHERE id = $1 AND status = 'active'",
      [sessionId]
    );

    if (sessionRes.rows.length === 0) {
      res.status(404).json({ error: "Active table session not found or already closed" });
      return;
    }

    const session = sessionRes.rows[0];

    // Enforce requirement: orders must be served or cancelled
    const unservedRes = await query(
      "SELECT id, status FROM orders WHERE session_id = $1 AND status NOT IN ('served', 'cancelled', 'completed')",
      [sessionId]
    );

    if (unservedRes.rows.length > 0) {
      res.status(400).json({
        error: `Cannot mark session as Paid. All orders must be Served or Cancelled before closing the session. Currently ${unservedRes.rows.length} order(s) are in progress.`,
        unservedCount: unservedRes.rows.length,
      });
      return;
    }

    await query(
      `UPDATE table_sessions
       SET status = 'finished', is_paid = true, finished_at = NOW()
       WHERE id = $1`,
      [sessionId]
    );

    await query(
      `UPDATE orders
       SET is_paid = true, is_active = false
       WHERE session_id = $1 AND status != 'cancelled'`,
      [sessionId]
    );

    broadcastSessionFinished(session.id, session.table_number);

    res.json({
      success: true,
      message: `Table ${session.table_number} session closed successfully`,
      session: {
        id: session.id,
        tableNumber: session.table_number,
        partySize: session.party_size,
        status: "finished",
        isPaid: true,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to finish table session", details: err.message });
  }
});

/**
 * POST /api/tables/:tableNumber/pay-session
 * Convenience alias for admin to mark table session as paid by tableNumber.
 */
router.post("/tables/:tableNumber/pay-session", async (req: Request, res: Response) => {
  try {
    if (!isAdminRequest(req)) {
      res.status(401).json({ error: "Admin authentication required" });
      return;
    }

    const tableNumber = String(req.params.tableNumber).trim();
    const sessionRes = await query(
      "SELECT * FROM table_sessions WHERE table_number = $1 AND status = 'active'",
      [tableNumber]
    );

    if (sessionRes.rows.length === 0) {
      res.status(404).json({ error: "No active session found for this table" });
      return;
    }

    const session = sessionRes.rows[0];

    const unservedRes = await query(
      "SELECT id, status FROM orders WHERE session_id = $1 AND status NOT IN ('served', 'cancelled', 'completed')",
      [session.id]
    );

    if (unservedRes.rows.length > 0) {
      res.status(400).json({
        error: `Cannot mark session as Paid: all orders must be served or cancelled before payment. (${unservedRes.rows.length} in progress)`,
        unservedCount: unservedRes.rows.length,
      });
      return;
    }

    await query(
      `UPDATE table_sessions
       SET status = 'finished', is_paid = true, finished_at = NOW()
       WHERE id = $1`,
      [session.id]
    );

    await query(
      `UPDATE orders
       SET is_paid = true, is_active = false
       WHERE session_id = $1 AND status != 'cancelled'`,
      [session.id]
    );

    broadcastSessionFinished(session.id, session.table_number);

    res.json({
      success: true,
      message: `Table ${tableNumber} session marked as Paid`,
      sessionId: session.id,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to pay table session", details: err.message });
  }
});

/**
 * POST /api/tables/:tableNumber/finish-session
 * Convenience alias for admin to finish table session by tableNumber.
 */
router.post("/tables/:tableNumber/finish-session", async (req: Request, res: Response) => {
  try {
    if (!isAdminRequest(req)) {
      res.status(401).json({ error: "Admin authentication required" });
      return;
    }

    const tableNumber = String(req.params.tableNumber).trim();
    const sessionRes = await query(
      "SELECT * FROM table_sessions WHERE table_number = $1 AND status = 'active'",
      [tableNumber]
    );

    if (sessionRes.rows.length === 0) {
      res.status(404).json({ error: "No active session found for this table" });
      return;
    }

    const session = sessionRes.rows[0];

    const unservedRes = await query(
      "SELECT id, status FROM orders WHERE session_id = $1 AND status NOT IN ('served', 'cancelled', 'completed')",
      [session.id]
    );

    if (unservedRes.rows.length > 0) {
      res.status(400).json({
        error: `Cannot mark session as Paid: all orders must be served or cancelled before payment. (${unservedRes.rows.length} in progress)`,
        unservedCount: unservedRes.rows.length,
      });
      return;
    }

    await query(
      `UPDATE table_sessions
       SET status = 'finished', is_paid = true, finished_at = NOW()
       WHERE id = $1`,
      [session.id]
    );

    await query(
      `UPDATE orders
       SET is_paid = true, is_active = false
       WHERE session_id = $1 AND status != 'cancelled'`,
      [session.id]
    );

    broadcastSessionFinished(session.id, session.table_number);

    res.json({
      success: true,
      message: `Table ${tableNumber} session finished`,
      session,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to finish table session", details: err.message });
  }
});

/**
 * POST /api/sessions/:id/close
 * Admin closes active table session without marking the bill as paid.
 * Ends guest access, disconnects guest Socket.IO room members, prevents new joins or orders.
 * Keeps all orders, order items, and order history strictly preserved.
 * Does NOT mark orders or the session as paid (is_paid remains false).
 * Does NOT cancel any orders (orders remain in their current status for staff kitchen prep & review).
 */
router.post("/sessions/:id/close", async (req: Request, res: Response) => {
  try {
    if (!isAdminRequest(req)) {
      res.status(401).json({ error: "Admin authentication required" });
      return;
    }

    const sessionId = parseInt(String(req.params.id), 10);

    const sessionRes = await query(
      "SELECT * FROM table_sessions WHERE id = $1 AND status = 'active'",
      [sessionId]
    );

    if (sessionRes.rows.length === 0) {
      res.status(404).json({ error: "Active table session not found or already closed" });
      return;
    }

    const session = sessionRes.rows[0];

    // Query unresolved orders for logging/response context
    const unresolvedRes = await query(
      "SELECT id, status, total FROM orders WHERE session_id = $1 AND status NOT IN ('served', 'cancelled', 'completed')",
      [sessionId]
    );

    // Mark session as closed while keeping is_paid as false
    await query(
      `UPDATE table_sessions
       SET status = 'closed', finished_at = NOW()
       WHERE id = $1`,
      [sessionId]
    );

    // Note: Orders are intentionally NOT modified:
    // - is_paid remains false
    // - status remains unchanged (e.g. pending, accepted, preparing, ready, served)
    // - is_active remains true for unresolved orders so admin/kitchen staff can continue prep & review

    // Disconnect guest socket room and notify clients
    broadcastSessionClosed(session.id, session.table_number);

    res.json({
      success: true,
      message: `Table ${session.table_number} session closed without marking as paid. Guest access revoked.`,
      sessionId: session.id,
      tableNumber: session.table_number,
      isPaid: false,
      unresolvedOrdersCount: unresolvedRes.rows.length,
      unresolvedOrders: unresolvedRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to close table session", details: err.message });
  }
});

/**
 * POST /api/tables/:tableNumber/close-session
 * Convenience alias for admin to close table session by tableNumber without marking bill as paid.
 */
router.post("/tables/:tableNumber/close-session", async (req: Request, res: Response) => {
  try {
    if (!isAdminRequest(req)) {
      res.status(401).json({ error: "Admin authentication required" });
      return;
    }

    const tableNumber = String(req.params.tableNumber).trim();
    const sessionRes = await query(
      "SELECT * FROM table_sessions WHERE table_number = $1 AND status = 'active'",
      [tableNumber]
    );

    if (sessionRes.rows.length === 0) {
      res.status(404).json({ error: "No active session found for this table" });
      return;
    }

    const session = sessionRes.rows[0];

    const unresolvedRes = await query(
      "SELECT id, status, total FROM orders WHERE session_id = $1 AND status NOT IN ('served', 'cancelled', 'completed')",
      [session.id]
    );

    await query(
      `UPDATE table_sessions
       SET status = 'closed', finished_at = NOW()
       WHERE id = $1`,
      [session.id]
    );

    broadcastSessionClosed(session.id, session.table_number);

    res.json({
      success: true,
      message: `Table ${session.table_number} session closed without marking as paid`,
      sessionId: session.id,
      tableNumber: session.table_number,
      isPaid: false,
      unresolvedOrdersCount: unresolvedRes.rows.length,
      unresolvedOrders: unresolvedRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to close table session", details: err.message });
  }
});

export default router;

