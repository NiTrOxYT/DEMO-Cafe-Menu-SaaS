import { Router } from "express";
import { db, ordersTable } from "../lib/db";
import { eq } from "drizzle-orm";

const router = Router();

function requireAdmin(req: any, res: any): boolean {
  const token = req.cookies?.admin_token;
  if (token !== "authenticated") {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  return true;
}

router.get("/orders", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const orders = await db
      .select()
      .from(ordersTable)
      .orderBy(ordersTable.createdAt);
    res.json(
      orders
        .map((o) => ({ ...o, totalAmount: Number(o.totalAmount) }))
        .reverse(),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/orders", async (req, res) => {
  const { tableNumber, customerName, items, totalAmount, notes } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Items are required" });
    return;
  }
  try {
    const [order] = await db
      .insert(ordersTable)
      .values({
        tableNumber: tableNumber ?? null,
        customerName: customerName ?? null,
        items,
        totalAmount: String(totalAmount ?? 0),
        status: "pending",
        whatsappSent: false,
        notes: notes ?? null,
      })
      .returning();
    res.status(201).json({ ...order, totalAmount: Number(order.totalAmount) });
  } catch (err) {
    req.log.error({ err }, "Failed to create order");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/orders/:id/status", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = Number(req.params.id);
  const { status } = req.body;
  if (
    !["pending", "preparing", "ready", "completed", "cancelled"].includes(
      status,
    )
  ) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  try {
    const [order] = await db
      .update(ordersTable)
      .set({ status })
      .where(eq(ordersTable.id, id))
      .returning();
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json({ ...order, totalAmount: Number(order.totalAmount) });
  } catch (err) {
    req.log.error({ err }, "Failed to update order status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/orders/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = Number(req.params.id);
  try {
    await db.delete(ordersTable).where(eq(ordersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete order");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
