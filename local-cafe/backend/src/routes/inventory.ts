import { Router, Request, Response } from "express";
import { query, pool } from "../db/index.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

// ==========================================
// 1. INVENTORY SUMMARY & ALERTS
// ==========================================
router.get("/inventory/summary", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, categoryId, menuItemId } = req.query;

    const itemConditions: string[] = [];
    const itemValues: any[] = [];
    let itemIdx = 1;

    if (categoryId) {
      itemConditions.push(`m.category_id = $${itemIdx++}`);
      itemValues.push(Number(categoryId));
    }
    if (menuItemId) {
      itemConditions.push(`m.id = $${itemIdx++}`);
      itemValues.push(Number(menuItemId));
    }

    const itemWhere = itemConditions.length > 0 ? `WHERE ${itemConditions.join(" AND ")}` : "";

    // 1. Current stock on hand and alert counts across menu items
    const stockQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE m.track_inventory = true) AS "totalTrackedItems",
        COALESCE(SUM(m.inventory_quantity) FILTER (WHERE m.track_inventory = true), 0) AS "totalStockOnHand",
        COUNT(*) FILTER (WHERE m.track_inventory = true AND m.inventory_quantity <= 0) AS "outOfStockCount",
        COUNT(*) FILTER (WHERE m.track_inventory = true AND m.inventory_quantity > 0 AND m.inventory_quantity <= m.low_stock_threshold) AS "lowStockCount"
      FROM menu_items m
      ${itemWhere}
    `;
    const stockRes = await query(stockQuery, itemValues);
    const summaryRow = stockRes.rows[0];

    // 1b. Stock on hand grouped by unit (prevents comparing cups to portions/pieces)
    const byUnitQuery = `
      SELECT 
        COALESCE(NULLIF(TRIM(m.inventory_unit), ''), 'portions') AS unit,
        COALESCE(SUM(m.inventory_quantity), 0) AS quantity
      FROM menu_items m
      WHERE m.track_inventory = true
      ${itemConditions.length > 0 ? `AND ${itemConditions.join(" AND ")}` : ""}
      GROUP BY COALESCE(NULLIF(TRIM(m.inventory_unit), ''), 'portions')
      ORDER BY unit ASC
    `;
    const byUnitRes = await query(byUnitQuery, itemValues);
    const stockOnHandByUnit = byUnitRes.rows.map((r: any) => ({
      unit: r.unit,
      quantity: parseFloat(r.quantity || "0"),
    }));

    // 2. Stock In and Stock Out movements during selected date range
    const movConditions: string[] = [];
    const movValues: any[] = [];
    let movIdx = 1;

    if (startDate) {
      movConditions.push(`im.created_at >= $${movIdx++}`);
      movValues.push(new Date(String(startDate)));
    }
    if (endDate) {
      movConditions.push(`im.created_at <= $${movIdx++}`);
      // If date string without time, include end of day
      const d = new Date(String(endDate));
      if (String(endDate).length <= 10) {
        d.setHours(23, 59, 59, 999);
      }
      movValues.push(d);
    }
    if (menuItemId) {
      movConditions.push(`im.menu_item_id = $${movIdx++}`);
      movValues.push(Number(menuItemId));
    }
    if (categoryId) {
      movConditions.push(`m.category_id = $${movIdx++}`);
      movValues.push(Number(categoryId));
    }

    const movWhere = movConditions.length > 0 ? `WHERE ${movConditions.join(" AND ")}` : "";

    const movQuery = `
      SELECT 
        COALESCE(SUM(im.quantity) FILTER (WHERE im.movement_type IN ('stock_in', 'opening_stock', 'order_reversal')), 0) AS "totalStockIn",
        COALESCE(SUM(im.quantity) FILTER (WHERE im.movement_type IN ('stock_out', 'order_deduction')), 0) AS "totalStockOut"
      FROM inventory_movements im
      JOIN menu_items m ON im.menu_item_id = m.id
      ${movWhere}
    `;
    const movRes = await query(movQuery, movValues);
    const movRow = movRes.rows[0];

    // 2b. Movements grouped by unit
    const movByUnitQuery = `
      SELECT 
        COALESCE(NULLIF(TRIM(im.unit), ''), 'portions') AS unit,
        COALESCE(SUM(im.quantity) FILTER (WHERE im.movement_type IN ('stock_in', 'opening_stock', 'order_reversal')), 0) AS "stockIn",
        COALESCE(SUM(im.quantity) FILTER (WHERE im.movement_type IN ('stock_out', 'order_deduction')), 0) AS "stockOut"
      FROM inventory_movements im
      JOIN menu_items m ON im.menu_item_id = m.id
      ${movWhere}
      GROUP BY COALESCE(NULLIF(TRIM(im.unit), ''), 'portions')
      ORDER BY unit ASC
    `;
    const movByUnitRes = await query(movByUnitQuery, movValues);
    const stockInByUnit = movByUnitRes.rows
      .filter((r: any) => parseFloat(r.stockIn || "0") > 0)
      .map((r: any) => ({ unit: r.unit, quantity: parseFloat(r.stockIn || "0") }));
    const stockOutByUnit = movByUnitRes.rows
      .filter((r: any) => parseFloat(r.stockOut || "0") > 0)
      .map((r: any) => ({ unit: r.unit, quantity: parseFloat(r.stockOut || "0") }));

    // 3. Low stock and out-of-stock alert items list
    const alertQuery = `
      SELECT 
        m.id,
        m.name,
        m.category_id AS "categoryId",
        c.name AS "categoryName",
        m.inventory_quantity AS "inventoryQuantity",
        m.inventory_unit AS "inventoryUnit",
        m.low_stock_threshold AS "lowStockThreshold",
        CASE 
          WHEN m.inventory_quantity <= 0 THEN 'out_of_stock'
          ELSE 'low_stock'
        END AS "alertType"
      FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE m.track_inventory = true 
        AND m.inventory_quantity <= m.low_stock_threshold
      ORDER BY m.inventory_quantity ASC, m.name ASC
      LIMIT 20
    `;
    const alertsRes = await query(alertQuery);

    res.json({
      totalTrackedItems: parseInt(summaryRow.totalTrackedItems || "0", 10),
      stockOnHandByUnit,
      stockInByUnit,
      stockOutByUnit,
      totalStockOnHand: parseFloat(summaryRow.totalStockOnHand || "0"),
      totalStockIn: parseFloat(movRow.totalStockIn || "0"),
      totalStockOut: parseFloat(movRow.totalStockOut || "0"),
      outOfStockCount: parseInt(summaryRow.outOfStockCount || "0", 10),
      lowStockCount: parseInt(summaryRow.lowStockCount || "0", 10),
      alerts: alertsRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch inventory summary", details: err.message });
  }
});

// ==========================================
// 2. INVENTORY ITEMS BREAKDOWN
// ==========================================
router.get("/inventory/items", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { categoryId, search, status } = req.query;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (categoryId) {
      conditions.push(`m.category_id = $${idx++}`);
      values.push(Number(categoryId));
    }

    if (search && String(search).trim()) {
      conditions.push(`m.name ILIKE $${idx++}`);
      values.push(`%${String(search).trim()}%`);
    }

    if (status === "out_of_stock") {
      conditions.push(`m.track_inventory = true AND m.inventory_quantity <= 0`);
    } else if (status === "low_stock") {
      conditions.push(`m.track_inventory = true AND m.inventory_quantity > 0 AND m.inventory_quantity <= m.low_stock_threshold`);
    } else if (status === "in_stock") {
      conditions.push(`m.track_inventory = true AND m.inventory_quantity > m.low_stock_threshold`);
    } else if (status === "tracked") {
      conditions.push(`m.track_inventory = true`);
    } else if (status === "untracked") {
      conditions.push(`m.track_inventory = false`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT 
        m.id,
        m.name,
        m.description,
        m.price,
        m.category_id AS "categoryId",
        c.name AS "categoryName",
        m.available,
        m.track_inventory AS "trackInventory",
        m.inventory_quantity AS "inventoryQuantity",
        m.inventory_unit AS "inventoryUnit",
        m.low_stock_threshold AS "lowStockThreshold",
        CASE 
          WHEN NOT m.track_inventory THEN 'untracked'
          WHEN m.inventory_quantity <= 0 THEN 'out_of_stock'
          WHEN m.inventory_quantity <= m.low_stock_threshold THEN 'low_stock'
          ELSE 'in_stock'
        END AS "stockStatus"
      FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id
      ${whereClause}
      ORDER BY m.sort_order ASC, m.id ASC
    `;

    const result = await query(sql, values);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch inventory items", details: err.message });
  }
});

// ==========================================
// 3. MOVEMENT HISTORY / AUDIT TRAIL
// ==========================================
router.get("/inventory/movements", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { menuItemId, movementType, startDate, endDate, limit = 100, offset = 0 } = req.query;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (menuItemId) {
      conditions.push(`im.menu_item_id = $${idx++}`);
      values.push(Number(menuItemId));
    }

    if (movementType) {
      conditions.push(`im.movement_type = $${idx++}`);
      values.push(String(movementType));
    }

    if (startDate) {
      conditions.push(`im.created_at >= $${idx++}`);
      values.push(new Date(String(startDate)));
    }

    if (endDate) {
      conditions.push(`im.created_at <= $${idx++}`);
      const d = new Date(String(endDate));
      if (String(endDate).length <= 10) {
        d.setHours(23, 59, 59, 999);
      }
      values.push(d);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `
      SELECT COUNT(*) AS total
      FROM inventory_movements im
      ${whereClause}
    `;
    const countRes = await query(countSql, values);
    const totalCount = parseInt(countRes.rows[0]?.total || "0", 10);

    const sql = `
      SELECT 
        im.id,
        im.menu_item_id AS "menuItemId",
        m.name AS "menuItemName",
        c.name AS "categoryName",
        im.movement_type AS "movementType",
        im.quantity,
        im.balance_after AS "balanceAfter",
        im.unit,
        im.reason,
        im.order_id AS "orderId",
        im.performed_by AS "performedBy",
        im.created_at AS "createdAt"
      FROM inventory_movements im
      JOIN menu_items m ON im.menu_item_id = m.id
      LEFT JOIN categories c ON m.category_id = c.id
      ${whereClause}
      ORDER BY im.created_at DESC, im.id DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    values.push(Math.min(200, Number(limit) || 100));
    values.push(Math.max(0, Number(offset) || 0));

    const result = await query(sql, values);
    res.json({
      total: totalCount,
      movements: result.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch movements", details: err.message });
  }
});

// ==========================================
// 4. MANUAL ADJUSTMENT (STOCK IN / STOCK OUT)
// ==========================================
router.post("/inventory/adjust", requireAdmin, async (req: Request, res: Response) => {
  const { menuItemId, movementType, quantity, unit, reason, date } = req.body || {};

  const parsedItemId = parseInt(String(menuItemId), 10);
  const parsedQty = parseFloat(String(quantity));
  const adminEmail = (req as any).admin?.email || "admin";

  if (!parsedItemId || isNaN(parsedQty) || parsedQty <= 0) {
    res.status(400).json({ error: "Valid menuItemId and quantity > 0 are required." });
    return;
  }

  const allowedTypes = ["stock_in", "stock_out", "opening_stock", "adjustment"];
  if (!allowedTypes.includes(movementType)) {
    res.status(400).json({ error: `Invalid movementType. Allowed: ${allowedTypes.join(", ")}` });
    return;
  }

  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query("BEGIN");
    inTransaction = true;

    // 1. Lock item row for safe transactional calculation
    const itemRes = await client.query(
      `SELECT id, name, track_inventory, inventory_quantity, inventory_unit, low_stock_threshold
       FROM menu_items
       WHERE id = $1
       FOR UPDATE`,
      [parsedItemId]
    );

    if (itemRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Menu item not found." });
      return;
    }

    const item = itemRes.rows[0];
    const currentQty = parseFloat(item.inventory_quantity || "0");
    const itemUnit = unit ? String(unit).trim() : (item.inventory_unit || "portions");

    let newBalance = currentQty;
    if (movementType === "stock_in" || movementType === "opening_stock") {
      newBalance = currentQty + parsedQty;
    } else if (movementType === "stock_out") {
      // Prevent negative stock
      if (currentQty - parsedQty < 0) {
        await client.query("ROLLBACK");
        res.status(400).json({
          error: `Insufficient stock on hand for ${item.name}. Current stock is ${currentQty} ${itemUnit}, cannot deduct ${parsedQty}.`,
          code: "NEGATIVE_STOCK_PREVENTED",
          currentStock: currentQty,
        });
        return;
      }
      newBalance = currentQty - parsedQty;
    } else if (movementType === "adjustment") {
      // Direct balance reset
      newBalance = parsedQty;
    }

    newBalance = Math.round(newBalance * 100) / 100;

    // 2. Update item stock and enable tracking if currently untracked
    await client.query(
      `UPDATE menu_items
       SET inventory_quantity = $1,
           track_inventory = true,
           inventory_unit = $2
       WHERE id = $3`,
      [newBalance, itemUnit, parsedItemId]
    );

    // 3. Insert audit movement record
    const movementDate =
      date && !isNaN(new Date(String(date)).getTime())
        ? new Date(String(date))
        : new Date();
    const movRes = await client.query(
      `INSERT INTO inventory_movements (
        menu_item_id, movement_type, quantity, balance_after, unit, reason, performed_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        parsedItemId,
        movementType,
        parsedQty,
        newBalance,
        itemUnit,
        reason ? String(reason).trim() : null,
        adminEmail,
        movementDate,
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      movement: movRes.rows[0],
      item: {
        id: item.id,
        name: item.name,
        trackInventory: true,
        inventoryQuantity: newBalance,
        inventoryUnit: itemUnit,
      },
    });
  } catch (err: any) {
    if (inTransaction) {
      await client.query("ROLLBACK").catch(() => {});
    }
    res.status(500).json({ error: "Failed to apply inventory adjustment", details: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 5. UPDATE ITEM INVENTORY SETTINGS
// ==========================================
router.patch("/inventory/items/:id/settings", requireAdmin, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const id = parseInt(String(req.params.id), 10);
    const { trackInventory, inventoryQuantity, inventoryUnit, lowStockThreshold } = req.body || {};
    const adminEmail = (req as any).admin?.email || "admin";

    await client.query("BEGIN");

    const itemRes = await client.query(
      "SELECT id, name, track_inventory, inventory_quantity, inventory_unit FROM menu_items WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (itemRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Menu item not found" });
      return;
    }

    const prevItem = itemRes.rows[0];
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    let targetTrack = prevItem.track_inventory;
    if (trackInventory !== undefined) {
      targetTrack = Boolean(trackInventory);
      updates.push(`track_inventory = $${idx++}`);
      values.push(targetTrack);
    }

    let targetUnit = prevItem.inventory_unit || "portions";
    if (inventoryUnit !== undefined) {
      targetUnit = String(inventoryUnit).trim();
      updates.push(`inventory_unit = $${idx++}`);
      values.push(targetUnit);
    }

    if (lowStockThreshold !== undefined) {
      updates.push(`low_stock_threshold = $${idx++}`);
      values.push(Math.max(0, Number(lowStockThreshold)));
    }

    let targetQty = parseFloat(prevItem.inventory_quantity || "0");
    if (inventoryQuantity !== undefined) {
      targetQty = Math.max(0, Number(inventoryQuantity));
      updates.push(`inventory_quantity = $${idx++}`);
      values.push(targetQty);
    }

    if (updates.length > 0) {
      values.push(id);
      await client.query(`UPDATE menu_items SET ${updates.join(", ")} WHERE id = $${idx}`, values);
    }

    // If tracking was newly enabled with opening quantity or quantity was reset, record movement
    if (inventoryQuantity !== undefined && targetTrack && targetQty > 0) {
      const isNewTracking = !prevItem.track_inventory && targetTrack;
      const movType = isNewTracking ? "opening_stock" : "adjustment";
      const reason = isNewTracking ? "Opening stock configured" : "Inventory settings reset";

      await client.query(
        `INSERT INTO inventory_movements (
          menu_item_id, movement_type, quantity, balance_after, unit, reason, performed_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [id, movType, targetQty, targetQty, targetUnit, reason, adminEmail]
      );
    }

    await client.query("COMMIT");

    const updatedRes = await query(
      `SELECT id, name, category_id AS "categoryId", price, available,
              track_inventory AS "trackInventory", inventory_quantity AS "inventoryQuantity",
              inventory_unit AS "inventoryUnit", low_stock_threshold AS "lowStockThreshold"
       FROM menu_items WHERE id = $1`,
      [id]
    );

    res.json(updatedRes.rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to update inventory settings", details: err.message });
  } finally {
    client.release();
  }
});

export default router;

