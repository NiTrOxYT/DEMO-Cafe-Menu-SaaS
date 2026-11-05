import { Router, Request, Response } from "express";
import { query, pool } from "../db/index.js";
import { generateOrderAccessToken, verifyOrderAccessToken } from "../lib/tokens.js";
import { verifyAdminToken } from "../lib/auth.js";
import {
  broadcastOrderCreated,
  broadcastOrderUpdated,
  broadcastOrderStatusChanged,
  broadcastOrderDeleted,
} from "../socket.js";

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
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);

    res.json(ordersRes.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch orders", details: err.message });
  }
});

// GET /api/orders/:id (Customer with capability token OR Admin)
router.get("/orders/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const orderToken = (req.headers["x-order-token"] as string) || (req.query.token as string);

    const ordersRes = await query(`
      SELECT 
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
        o.whatsapp_sent,
        o.notes,
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

    // Authorization: Admin session OR valid capability token
    const isAdmin = isAdminRequest(req);
    const hasValidToken = verifyOrderAccessToken(orderToken, order.order_access_token_hash);

    if (!isAdmin && !hasValidToken) {
      res.status(403).json({ error: "Access denied. Valid order capability token required." });
      return;
    }

    // Do not leak token hash in response
    delete order.order_access_token_hash;
    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch order", details: err.message });
  }
});

// POST /api/orders (Create new order + line items; generates capability token; broadcasts order:created)
router.post("/orders", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      tableNumber,
      tableId,
      items,
      notes,
      customerName,
      customerPhone,
      subtotal,
      tax = 0,
      total,
      cafeId = 1,
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Order must contain at least one item." });
      return;
    }

    const { token: plainToken, hash: tokenHash } = generateOrderAccessToken();

    await client.query("BEGIN");

    // 1. Create parent order
    const calculatedSubtotal = Number(subtotal) || items.reduce((acc: number, item: any) => acc + (Number(item.price) * (item.quantity || 1)), 0);
    const calculatedTotal = Number(total) || (calculatedSubtotal + Number(tax));

    const orderRes = await client.query(
      `INSERT INTO orders (
        cafe_id, table_id, table_number, customer_name, customer_phone,
        subtotal, tax, total, status, is_active, is_paid, is_updated,
        notes, order_access_token_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', true, false, false, $9, $10, NOW())
      RETURNING *`,
      [
        Number(cafeId) || 1,
        tableId ? Number(tableId) : (tableNumber ? Number(tableNumber) : null),
        tableNumber ? String(tableNumber) : (tableId ? String(tableId) : "1"),
        customerName || null,
        customerPhone || null,
        calculatedSubtotal,
        Number(tax) || 0,
        calculatedTotal,
        notes || null,
        tokenHash,
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

    // Broadcast over Socket.IO to admin kitchen board
    broadcastOrderCreated(order);

    // Return order with plain capability token for customer storage
    delete order.order_access_token_hash;
    res.status(201).json({
      ...order,
      orderAccessToken: plainToken,
    });
  } catch (err: any) {
    await client.query("ROLLBACK");
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

    // Check capability token or admin
    if (!isAdminRequest(req) && !verifyOrderAccessToken(orderToken, existingOrder.order_access_token_hash)) {
      res.status(403).json({ error: "Access denied. Valid order capability token required." });
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

    // Broadcast realtime update
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

// PATCH /api/orders/:id/status (Admin or cashier updates order status)
router.patch("/orders/:id/status", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const { status } = req.body || {};

    if (!status) {
      res.status(400).json({ error: "Status is required." });
      return;
    }

    const isActive = status === "completed" ? false : true;
    const isPaid = status === "completed" ? true : false;

    const updateFields = [
      "status = $1",
      "is_active = $2",
      "is_paid = $3",
    ];
    const values: any[] = [status, isActive, isPaid];
    let idx = 4;

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

    // Broadcast status change over Socket.IO
    broadcastOrderStatusChanged(id, status, isActive, isPaid);

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
    const result = await query("DELETE FROM orders WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    broadcastOrderDeleted(id);
    res.json({ success: true, message: "Order deleted", id });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete order", details: err.message });
  }
});

export default router;

