import { Router, Request, Response } from "express";
import { query, pool } from "../db/index.js";
import { requireAdmin } from "../lib/auth.js";
import {
  normalizeUnit,
  areUnitsCompatible,
  convertUnitQuantity,
  SUPPORTED_UNITS,
  isValidUnit,
} from "../lib/units.js";

const router = Router();

// ==========================================
// 1. RAW MATERIALS SUMMARY & KPI ALERTS
// ==========================================
router.get("/raw-materials/summary", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, category, supplier } = req.query;

    const itemConditions: string[] = ["r.is_archived = false"];
    const itemValues: any[] = [];
    let itemIdx = 1;

    if (category && category !== "all") {
      itemConditions.push(`LOWER(r.category) = LOWER($${itemIdx++})`);
      itemValues.push(String(category).trim());
    }
    if (supplier && supplier !== "all") {
      itemConditions.push(`LOWER(r.supplier) = LOWER($${itemIdx++})`);
      itemValues.push(String(supplier).trim());
    }

    const itemWhere = `WHERE ${itemConditions.join(" AND ")}`;

    // 1a. Item totals and inventory value (only computed where unit_cost is present)
    const stockQuery = `
      SELECT 
        COUNT(*) AS "totalItems",
        COALESCE(SUM(CASE WHEN r.unit_cost IS NOT NULL AND r.unit_cost > 0 THEN r.current_stock * r.unit_cost ELSE 0 END), 0) AS "totalInventoryValue",
        COUNT(*) FILTER (WHERE r.current_stock <= 0) AS "outOfStockCount",
        COUNT(*) FILTER (WHERE r.current_stock > 0 AND r.current_stock <= r.low_stock_threshold) AS "lowStockCount",
        COUNT(*) FILTER (WHERE r.expiry_date IS NOT NULL AND r.expiry_date <= (CURRENT_DATE + INTERVAL '7 days')) AS "expiringSoonCount"
      FROM raw_materials r
      ${itemWhere}
    `;
    const stockRes = await query(stockQuery, itemValues);
    const summaryRow = stockRes.rows[0];

    // 1b. Stock on hand grouped by base unit (prevents combining incompatible units)
    const byUnitQuery = `
      SELECT 
        r.base_unit AS unit,
        COALESCE(SUM(r.current_stock), 0) AS quantity
      FROM raw_materials r
      ${itemWhere}
      GROUP BY r.base_unit
      ORDER BY r.base_unit ASC
    `;
    const byUnitRes = await query(byUnitQuery, itemValues);
    const stockByUnit = byUnitRes.rows.map((r: any) => ({
      unit: r.unit,
      quantity: parseFloat(r.quantity || "0"),
    }));

    // 2. Stock In and Stock Out movements in selected date range
    const movConditions: string[] = [];
    const movValues: any[] = [];
    let movIdx = 1;

    if (startDate) {
      movConditions.push(`rmm.created_at >= $${movIdx++}`);
      movValues.push(new Date(String(startDate)));
    }
    if (endDate) {
      movConditions.push(`rmm.created_at <= $${movIdx++}`);
      const d = new Date(String(endDate));
      if (String(endDate).length <= 10) d.setHours(23, 59, 59, 999);
      movValues.push(d);
    }
    if (category && category !== "all") {
      movConditions.push(`LOWER(r.category) = LOWER($${movIdx++})`);
      movValues.push(String(category).trim());
    }
    if (supplier && supplier !== "all") {
      movConditions.push(`LOWER(rmm.supplier) = LOWER($${movIdx++})`);
      movValues.push(String(supplier).trim());
    }

    const movWhere = movConditions.length > 0 ? `WHERE ${movConditions.join(" AND ")}` : "";

    const movByUnitQuery = `
      SELECT 
        r.base_unit AS unit,
        COALESCE(SUM(rmm.base_quantity) FILTER (WHERE rmm.movement_type IN ('stock_in', 'opening_stock', 'order_reversal')), 0) AS "stockIn",
        COALESCE(SUM(rmm.base_quantity) FILTER (WHERE rmm.movement_type IN ('stock_out', 'recipe_consumption')), 0) AS "stockOut"
      FROM raw_material_movements rmm
      JOIN raw_materials r ON rmm.raw_material_id = r.id
      ${movWhere}
      GROUP BY r.base_unit
      ORDER BY r.base_unit ASC
    `;
    const movByUnitRes = await query(movByUnitQuery, movValues);

    const stockInByUnit: Array<{ unit: string; quantity: number }> = [];
    const stockOutByUnit: Array<{ unit: string; quantity: number }> = [];

    for (const row of movByUnitRes.rows) {
      const inQty = parseFloat(row.stockIn || "0");
      const outQty = parseFloat(row.stockOut || "0");
      if (inQty > 0) stockInByUnit.push({ unit: row.unit, quantity: inQty });
      if (outQty > 0) stockOutByUnit.push({ unit: row.unit, quantity: outQty });
    }

    // 3. Active alerts (low stock, out of stock, near expiry)
    const alertQuery = `
      SELECT 
        r.id,
        r.name,
        r.category,
        r.current_stock AS "currentStock",
        r.base_unit AS "baseUnit",
        r.low_stock_threshold AS "lowStockThreshold",
        r.expiry_date AS "expiryDate",
        r.batch_number AS "batchNumber",
        r.supplier,
        CASE 
          WHEN r.current_stock <= 0 THEN 'out_of_stock'
          WHEN r.current_stock <= r.low_stock_threshold THEN 'low_stock'
          WHEN r.expiry_date IS NOT NULL AND r.expiry_date <= (CURRENT_DATE + INTERVAL '7 days') THEN 'expiring_soon'
          ELSE 'normal'
        END AS "alertType"
      FROM raw_materials r
      WHERE r.is_archived = false
        AND (
          r.current_stock <= r.low_stock_threshold
          OR (r.expiry_date IS NOT NULL AND r.expiry_date <= (CURRENT_DATE + INTERVAL '7 days'))
        )
      ORDER BY 
        CASE 
          WHEN r.current_stock <= 0 THEN 1 
          WHEN r.expiry_date <= CURRENT_DATE THEN 2
          ELSE 3 
        END ASC,
        r.name ASC
      LIMIT 25
    `;
    const alertRes = await query(alertQuery);

    res.json({
      totalItems: parseInt(summaryRow.totalItems || "0", 10),
      totalInventoryValue: parseFloat(summaryRow.totalInventoryValue || "0"),
      outOfStockCount: parseInt(summaryRow.outOfStockCount || "0", 10),
      lowStockCount: parseInt(summaryRow.lowStockCount || "0", 10),
      expiringSoonCount: parseInt(summaryRow.expiringSoonCount || "0", 10),
      stockByUnit,
      stockInByUnit,
      stockOutByUnit,
      alerts: alertRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch raw materials summary", details: err.message });
  }
});

// ==========================================
// 2. RAW MATERIALS CATALOG LIST
// ==========================================
router.get("/raw-materials", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { search, category, supplier, status, includeArchived } = req.query;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (includeArchived !== "true") {
      conditions.push("r.is_archived = false");
    }

    if (category && category !== "all") {
      conditions.push(`LOWER(r.category) = LOWER($${idx++})`);
      values.push(String(category).trim());
    }

    if (supplier && supplier !== "all") {
      conditions.push(`LOWER(r.supplier) = LOWER($${idx++})`);
      values.push(String(supplier).trim());
    }

    if (search && String(search).trim()) {
      conditions.push(`(r.name ILIKE $${idx} OR r.sku ILIKE $${idx} OR r.supplier ILIKE $${idx} OR r.category ILIKE $${idx})`);
      values.push(`%${String(search).trim()}%`);
      idx++;
    }

    if (status === "out_of_stock") {
      conditions.push("r.current_stock <= 0");
    } else if (status === "low_stock") {
      conditions.push("r.current_stock > 0 AND r.current_stock <= r.low_stock_threshold");
    } else if (status === "in_stock") {
      conditions.push("r.current_stock > r.low_stock_threshold");
    } else if (status === "expiring_soon") {
      conditions.push("r.expiry_date IS NOT NULL AND r.expiry_date <= (CURRENT_DATE + INTERVAL '7 days')");
    } else if (status === "archived") {
      conditions.push("r.is_archived = true");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT 
        r.id,
        r.name,
        r.category,
        r.sku,
        r.base_unit AS "baseUnit",
        r.current_stock AS "currentStock",
        r.low_stock_threshold AS "lowStockThreshold",
        r.supplier,
        r.unit_cost AS "unitCost",
        r.batch_number AS "batchNumber",
        r.expiry_date AS "expiryDate",
        r.is_archived AS "isArchived",
        r.created_at AS "createdAt",
        r.updated_at AS "updatedAt",
        CASE 
          WHEN r.unit_cost IS NOT NULL AND r.unit_cost > 0 THEN ROUND((r.current_stock * r.unit_cost)::numeric, 2)
          ELSE NULL
        END AS "totalValue",
        CASE 
          WHEN r.is_archived = true THEN 'archived'
          WHEN r.current_stock <= 0 THEN 'out_of_stock'
          WHEN r.current_stock <= r.low_stock_threshold THEN 'low_stock'
          WHEN r.expiry_date IS NOT NULL AND r.expiry_date <= (CURRENT_DATE + INTERVAL '7 days') THEN 'expiring_soon'
          ELSE 'in_stock'
        END AS "status",
        (SELECT COUNT(*) FROM menu_item_recipes mir WHERE mir.raw_material_id = r.id) AS "recipeUsageCount"
      FROM raw_materials r
      ${whereClause}
      ORDER BY r.is_archived ASC, r.name ASC
    `;

    const result = await query(sql, values);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch raw materials", details: err.message });
  }
});

// ==========================================
// 3. CREATE RAW MATERIAL ITEM
// ==========================================
router.post("/raw-materials", requireAdmin, async (req: Request, res: Response) => {
  const {
    name,
    category,
    sku,
    baseUnit,
    currentStock,
    lowStockThreshold,
    supplier,
    unitCost,
    batchNumber,
    expiryDate,
  } = req.body || {};

  if (!name || !String(name).trim()) {
    res.status(400).json({ error: "Item name is required." });
    return;
  }

  const normUnit = normalizeUnit(baseUnit || "kg");
  if (!isValidUnit(normUnit)) {
    res.status(400).json({
      error: `Unsupported base unit "${baseUnit}". Supported units: ${SUPPORTED_UNITS.join(", ")}`,
    });
    return;
  }

  const stockQty = Math.max(0, parseFloat(String(currentStock || 0)) || 0);
  const threshold = Math.max(0, parseFloat(String(lowStockThreshold || 2)) || 2);
  const cost = unitCost !== undefined && unitCost !== null && unitCost !== "" ? parseFloat(String(unitCost)) : null;
  const adminEmail = (req as any).admin?.email || "admin";

  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query("BEGIN");
    inTransaction = true;

    const insertSql = `
      INSERT INTO raw_materials (
        name, category, sku, base_unit, current_stock, low_stock_threshold,
        supplier, unit_cost, batch_number, expiry_date, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `;

    const insertRes = await client.query(insertSql, [
      name.trim(),
      (category || "Ingredients").trim(),
      sku ? String(sku).trim() : null,
      normUnit,
      stockQty,
      threshold,
      supplier ? String(supplier).trim() : null,
      cost,
      batchNumber ? String(batchNumber).trim() : null,
      expiryDate ? new Date(String(expiryDate)) : null,
    ]);

    const createdItem = insertRes.rows[0];

    // If opening stock was configured > 0, write opening audit movement
    if (stockQty > 0) {
      await client.query(
        `INSERT INTO raw_material_movements (
          raw_material_id, movement_type, quantity, unit, base_quantity,
          balance_before, balance_after, unit_cost, total_cost, supplier,
          batch_number, expiry_date, reason, performed_by, created_at
        ) VALUES ($1, 'opening_stock', $2, $3, $4, 0, $5, $6, $7, $8, $9, $10, 'Opening stock initialization', $11, NOW())`,
        [
          createdItem.id,
          stockQty,
          normUnit,
          stockQty,
          stockQty,
          cost,
          cost ? stockQty * cost : null,
          createdItem.supplier,
          createdItem.batch_number,
          createdItem.expiry_date,
          adminEmail,
        ]
      );
    }

    await client.query("COMMIT");

    res.status(201).json(createdItem);
  } catch (err: any) {
    if (inTransaction) await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: "Failed to create raw material", details: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 4. UPDATE RAW MATERIAL ITEM
// ==========================================
router.patch("/raw-materials/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!id) {
      res.status(400).json({ error: "Invalid item ID." });
      return;
    }

    const {
      name,
      category,
      sku,
      baseUnit,
      lowStockThreshold,
      supplier,
      unitCost,
      batchNumber,
      expiryDate,
      isArchived,
    } = req.body || {};

    const fields: string[] = ["updated_at = NOW()"];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(String(name).trim());
    }
    if (category !== undefined) {
      fields.push(`category = $${idx++}`);
      values.push(String(category).trim());
    }
    if (sku !== undefined) {
      fields.push(`sku = $${idx++}`);
      values.push(sku ? String(sku).trim() : null);
    }
    if (baseUnit !== undefined) {
      const norm = normalizeUnit(String(baseUnit));
      if (!isValidUnit(norm)) {
        res.status(400).json({
          error: `Unsupported base unit "${baseUnit}". Supported units: ${SUPPORTED_UNITS.join(", ")}`,
        });
        return;
      }
      fields.push(`base_unit = $${idx++}`);
      values.push(norm);
    }
    if (lowStockThreshold !== undefined) {
      fields.push(`low_stock_threshold = $${idx++}`);
      values.push(Math.max(0, parseFloat(String(lowStockThreshold)) || 0));
    }
    if (supplier !== undefined) {
      fields.push(`supplier = $${idx++}`);
      values.push(supplier ? String(supplier).trim() : null);
    }
    if (unitCost !== undefined) {
      fields.push(`unit_cost = $${idx++}`);
      values.push(unitCost !== null && unitCost !== "" ? parseFloat(String(unitCost)) : null);
    }
    if (batchNumber !== undefined) {
      fields.push(`batch_number = $${idx++}`);
      values.push(batchNumber ? String(batchNumber).trim() : null);
    }
    if (expiryDate !== undefined) {
      fields.push(`expiry_date = $${idx++}`);
      values.push(expiryDate ? new Date(String(expiryDate)) : null);
    }
    if (isArchived !== undefined) {
      fields.push(`is_archived = $${idx++}`);
      values.push(Boolean(isArchived));
    }

    values.push(id);
    const sql = `
      UPDATE raw_materials
      SET ${fields.join(", ")}
      WHERE id = $${idx}
      RETURNING *
    `;

    const resUpdate = await query(sql, values);
    if (resUpdate.rows.length === 0) {
      res.status(404).json({ error: "Raw material item not found." });
      return;
    }

    res.json(resUpdate.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update raw material", details: err.message });
  }
});

// ==========================================
// 5. ARCHIVE / RESTORE RAW MATERIAL
// ==========================================
router.delete("/raw-materials/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    // Soft deletion: archive the material to preserve immutable movement logs & recipe history
    const resArchive = await query(
      "UPDATE raw_materials SET is_archived = true, updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    if (resArchive.rows.length === 0) {
      res.status(404).json({ error: "Raw material item not found." });
      return;
    }
    res.json({ success: true, item: resArchive.rows[0], message: "Raw material archived successfully." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to archive raw material", details: err.message });
  }
});

router.post("/raw-materials/:id/restore", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    // Restore archived material
    const resRestore = await query(
      "UPDATE raw_materials SET is_archived = false, updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    if (resRestore.rows.length === 0) {
      res.status(404).json({ error: "Raw material item not found." });
      return;
    }
    res.json({ success: true, item: resRestore.rows[0], message: "Raw material restored successfully." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to restore raw material", details: err.message });
  }
});

// ==========================================
// 6. RECORD STOCK MOVEMENT (STOCK IN / STOCK OUT / ADJUSTMENT)
// ==========================================
router.post("/raw-materials/:id/movements", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const {
    movementType,
    quantity,
    unit,
    reason,
    supplier,
    invoiceRef,
    unitCost,
    batchNumber,
    expiryDate,
    date,
  } = req.body || {};

  const parsedQty = parseFloat(String(quantity));
  if (isNaN(parsedQty) || parsedQty <= 0) {
    res.status(400).json({ error: "Quantity must be a positive number greater than 0." });
    return;
  }

  const allowedTypes = ["stock_in", "stock_out", "adjustment"];
  if (!allowedTypes.includes(movementType)) {
    res.status(400).json({ error: `Invalid movementType. Allowed: ${allowedTypes.join(", ")}` });
    return;
  }

  if ((movementType === "stock_out" || movementType === "adjustment") && (!reason || !String(reason).trim())) {
    res.status(400).json({ error: "Reason is required for Stock Out and Adjustment movements." });
    return;
  }

  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query("BEGIN");
    inTransaction = true;

    // Lock item row for atomic balance calculation
    const itemRes = await client.query(
      `SELECT id, name, category, base_unit, current_stock, unit_cost, batch_number, expiry_date, supplier
       FROM raw_materials
       WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (itemRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Raw material item not found." });
      return;
    }

    const item = itemRes.rows[0];
    const movementUnit = unit ? normalizeUnit(String(unit)) : item.base_unit;
    if (!isValidUnit(movementUnit)) {
      await client.query("ROLLBACK");
      res.status(400).json({
        error: `Unsupported movement unit "${unit}". Supported units: ${SUPPORTED_UNITS.join(", ")}`,
      });
      return;
    }

    // Validate unit compatibility with base_unit
    if (!areUnitsCompatible(movementUnit, item.base_unit)) {
      await client.query("ROLLBACK");
      res.status(400).json({
        error: `Incompatible unit: Item base unit is "${item.base_unit}", cannot record movement in "${movementUnit}".`,
      });
      return;
    }

    // Convert input quantity into base unit quantity
    const baseQuantity = convertUnitQuantity(parsedQty, movementUnit, item.base_unit);
    const balanceBefore = parseFloat(item.current_stock || "0");
    let balanceAfter = balanceBefore;

    if (movementType === "stock_in") {
      balanceAfter = balanceBefore + baseQuantity;
    } else if (movementType === "stock_out") {
      if (balanceBefore - baseQuantity < 0) {
        await client.query("ROLLBACK");
        res.status(400).json({
          error: `Insufficient stock on hand for "${item.name}". Current stock is ${balanceBefore} ${item.base_unit}, cannot deduct ${baseQuantity} ${item.base_unit}.`,
          code: "NEGATIVE_STOCK_PREVENTED",
          currentStock: balanceBefore,
        });
        return;
      }
      balanceAfter = balanceBefore - baseQuantity;
    } else if (movementType === "adjustment") {
      balanceAfter = baseQuantity;
    }

    balanceAfter = Math.round(balanceAfter * 1000) / 1000;

    const parsedUnitCost =
      unitCost !== undefined && unitCost !== null && unitCost !== ""
        ? parseFloat(String(unitCost))
        : item.unit_cost !== null
        ? parseFloat(item.unit_cost)
        : null;

    const totalCost = parsedUnitCost ? Math.round(parsedQty * parsedUnitCost * 100) / 100 : null;
    const adminEmail = (req as any).admin?.email || "admin";
    const movementDate =
      date && !isNaN(new Date(String(date)).getTime()) ? new Date(String(date)) : new Date();

    // 1. Update item current_stock (and batch/expiry/supplier/cost if provided on Stock In)
    const updateFields: string[] = ["current_stock = $1", "updated_at = NOW()"];
    const updateVals: any[] = [balanceAfter];
    let uIdx = 2;

    if (movementType === "stock_in") {
      if (parsedUnitCost !== null) {
        updateFields.push(`unit_cost = $${uIdx++}`);
        updateVals.push(parsedUnitCost);
      }
      if (batchNumber) {
        updateFields.push(`batch_number = $${uIdx++}`);
        updateVals.push(String(batchNumber).trim());
      }
      if (expiryDate) {
        updateFields.push(`expiry_date = $${uIdx++}`);
        updateVals.push(new Date(String(expiryDate)));
      }
      if (supplier) {
        updateFields.push(`supplier = $${uIdx++}`);
        updateVals.push(String(supplier).trim());
      }
    }

    updateVals.push(id);
    await client.query(
      `UPDATE raw_materials SET ${updateFields.join(", ")} WHERE id = $${uIdx}`,
      updateVals
    );

    // 2. Insert exactly one movement record
    const movRes = await client.query(
      `INSERT INTO raw_material_movements (
        raw_material_id, movement_type, quantity, unit, base_quantity,
        balance_before, balance_after, unit_cost, total_cost, supplier,
        invoice_ref, batch_number, expiry_date, reason, performed_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        id,
        movementType,
        parsedQty,
        movementUnit,
        baseQuantity,
        balanceBefore,
        balanceAfter,
        parsedUnitCost,
        totalCost,
        supplier ? String(supplier).trim() : item.supplier,
        invoiceRef ? String(invoiceRef).trim() : null,
        batchNumber ? String(batchNumber).trim() : item.batch_number,
        expiryDate ? new Date(String(expiryDate)) : item.expiry_date,
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
        currentStock: balanceAfter,
        baseUnit: item.base_unit,
      },
    });
  } catch (err: any) {
    if (inTransaction) await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: "Failed to record raw material movement", details: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 7. GET RAW MATERIAL MOVEMENTS
// ==========================================
router.get("/raw-materials/movements", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rawMaterialId, movementType, startDate, endDate, supplier, search, limit, offset } = req.query;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (rawMaterialId) {
      conditions.push(`rmm.raw_material_id = $${idx++}`);
      values.push(parseInt(String(rawMaterialId), 10));
    }
    if (movementType && movementType !== "all") {
      conditions.push(`rmm.movement_type = $${idx++}`);
      values.push(String(movementType).trim());
    }
    if (supplier && supplier !== "all") {
      conditions.push(`LOWER(rmm.supplier) = LOWER($${idx++})`);
      values.push(String(supplier).trim());
    }
    if (startDate) {
      conditions.push(`rmm.created_at >= $${idx++}`);
      values.push(new Date(String(startDate)));
    }
    if (endDate) {
      conditions.push(`rmm.created_at <= $${idx++}`);
      const d = new Date(String(endDate));
      if (String(endDate).length <= 10) d.setHours(23, 59, 59, 999);
      values.push(d);
    }
    if (search && String(search).trim()) {
      conditions.push(`(r.name ILIKE $${idx} OR rmm.reason ILIKE $${idx} OR rmm.invoice_ref ILIKE $${idx})`);
      values.push(`%${String(search).trim()}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query(
      `SELECT COUNT(*) FROM raw_material_movements rmm JOIN raw_materials r ON rmm.raw_material_id = r.id ${whereClause}`,
      values
    );
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const listQuery = `
      SELECT 
        rmm.id,
        rmm.raw_material_id AS "rawMaterialId",
        r.name AS "rawMaterialName",
        r.category AS "category",
        rmm.movement_type AS "movementType",
        rmm.quantity,
        rmm.unit,
        rmm.base_quantity AS "baseQuantity",
        r.base_unit AS "baseUnit",
        rmm.balance_before AS "balanceBefore",
        rmm.balance_after AS "balanceAfter",
        rmm.unit_cost AS "unitCost",
        rmm.total_cost AS "totalCost",
        rmm.supplier,
        rmm.invoice_ref AS "invoiceRef",
        rmm.batch_number AS "batchNumber",
        rmm.expiry_date AS "expiryDate",
        rmm.reason,
        rmm.order_id AS "orderId",
        rmm.performed_by AS "performedBy",
        rmm.created_at AS "createdAt"
      FROM raw_material_movements rmm
      JOIN raw_materials r ON rmm.raw_material_id = r.id
      ${whereClause}
      ORDER BY rmm.created_at DESC, rmm.id DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    values.push(Math.min(500, Number(limit) || 100));
    values.push(Math.max(0, Number(offset) || 0));

    const listRes = await query(listQuery, values);
    res.json({
      total: totalCount,
      movements: listRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch movements", details: err.message });
  }
});

// ==========================================
// 8. CSV EXPORT FOR MOVEMENTS
// ==========================================
router.get("/raw-materials/movements/export-csv", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rawMaterialId, movementType, startDate, endDate } = req.query;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (rawMaterialId) {
      conditions.push(`rmm.raw_material_id = $${idx++}`);
      values.push(parseInt(String(rawMaterialId), 10));
    }
    if (movementType && movementType !== "all") {
      conditions.push(`rmm.movement_type = $${idx++}`);
      values.push(String(movementType).trim());
    }
    if (startDate) {
      conditions.push(`rmm.created_at >= $${idx++}`);
      values.push(new Date(String(startDate)));
    }
    if (endDate) {
      conditions.push(`rmm.created_at <= $${idx++}`);
      const d = new Date(String(endDate));
      if (String(endDate).length <= 10) d.setHours(23, 59, 59, 999);
      values.push(d);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT 
        rmm.created_at,
        r.name,
        r.category,
        rmm.movement_type,
        rmm.quantity,
        rmm.unit,
        rmm.base_quantity,
        r.base_unit,
        rmm.balance_before,
        rmm.balance_after,
        rmm.unit_cost,
        rmm.total_cost,
        rmm.supplier,
        rmm.invoice_ref,
        rmm.batch_number,
        rmm.expiry_date,
        rmm.reason,
        rmm.order_id,
        rmm.performed_by
      FROM raw_material_movements rmm
      JOIN raw_materials r ON rmm.raw_material_id = r.id
      ${whereClause}
      ORDER BY rmm.created_at DESC, rmm.id DESC
      LIMIT 2000
    `;

    const result = await query(sql, values);

    // Build CSV
    const headers = [
      "Timestamp",
      "Item Name",
      "Category",
      "Movement Type",
      "Quantity",
      "Unit",
      "Base Quantity",
      "Base Unit",
      "Balance Before",
      "Balance After",
      "Unit Cost",
      "Total Cost",
      "Supplier",
      "Invoice/Ref",
      "Batch Number",
      "Expiry Date",
      "Reason",
      "Order ID",
      "Performed By",
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return "";
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = [headers.join(",")];
    for (const r of result.rows) {
      rows.push(
        [
          escapeCsv(new Date(r.created_at).toISOString()),
          escapeCsv(r.name),
          escapeCsv(r.category),
          escapeCsv(r.movement_type),
          escapeCsv(r.quantity),
          escapeCsv(r.unit),
          escapeCsv(r.base_quantity),
          escapeCsv(r.base_unit),
          escapeCsv(r.balance_before),
          escapeCsv(r.balance_after),
          escapeCsv(r.unit_cost),
          escapeCsv(r.total_cost),
          escapeCsv(r.supplier),
          escapeCsv(r.invoice_ref),
          escapeCsv(r.batch_number),
          escapeCsv(r.expiry_date ? new Date(r.expiry_date).toISOString().substring(0, 10) : ""),
          escapeCsv(r.reason),
          escapeCsv(r.order_id),
          escapeCsv(r.performed_by),
        ].join(",")
      );
    }

    const csvContent = rows.join("\r\n");
    const filename = `raw-materials-movements-${new Date().toISOString().substring(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to export CSV", details: err.message });
  }
});

// ==========================================
// 9. MENU ITEM RECIPES LIST & DETAILS
// ==========================================
router.get("/raw-materials/recipes", requireAdmin, async (req: Request, res: Response) => {
  try {
    const sql = `
      SELECT 
        m.id AS "menuItemId",
        m.name AS "menuItemName",
        m.price AS "menuItemPrice",
        c.name AS "categoryName",
        m.available,
        COALESCE(
          json_agg(
            json_build_object(
              'id', mir.id,
              'rawMaterialId', r.id,
              'rawMaterialName', r.name,
              'quantity', mir.quantity,
              'unit', mir.unit,
              'notes', mir.notes,
              'baseUnit', r.base_unit,
              'currentStock', r.current_stock,
              'isArchived', r.is_archived
            )
          ) FILTER (WHERE mir.id IS NOT NULL),
          '[]'::json
        ) AS "ingredients"
      FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN menu_item_recipes mir ON m.id = mir.menu_item_id
      LEFT JOIN raw_materials r ON mir.raw_material_id = r.id
      GROUP BY m.id, m.name, m.price, c.name, m.available, m.sort_order
      ORDER BY c.name ASC, m.sort_order ASC, m.name ASC
    `;

    const result = await query(sql);
    const itemsWithRecipeStatus = result.rows.map((row: any) => ({
      ...row,
      hasRecipe: Array.isArray(row.ingredients) && row.ingredients.length > 0,
    }));

    res.json(itemsWithRecipeStatus);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch recipes", details: err.message });
  }
});

router.get("/raw-materials/recipes/:menuItemId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const menuItemId = parseInt(String(req.params.menuItemId), 10);
    const sql = `
      SELECT 
        mir.id,
        mir.raw_material_id AS "rawMaterialId",
        r.name AS "rawMaterialName",
        r.base_unit AS "baseUnit",
        r.current_stock AS "currentStock",
        r.is_archived AS "isArchived",
        mir.quantity,
        mir.unit,
        mir.notes
      FROM menu_item_recipes mir
      JOIN raw_materials r ON mir.raw_material_id = r.id
      WHERE mir.menu_item_id = $1
      ORDER BY r.name ASC
    `;
    const result = await query(sql, [menuItemId]);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch menu item recipe", details: err.message });
  }
});

// ==========================================
// 10. SAVE / UPDATE MENU ITEM RECIPE
// ==========================================
router.put("/raw-materials/recipes/:menuItemId", requireAdmin, async (req: Request, res: Response) => {
  const menuItemId = parseInt(String(req.params.menuItemId), 10);
  const { ingredients } = req.body || {};

  if (!menuItemId) {
    res.status(400).json({ error: "Invalid menuItemId." });
    return;
  }

  if (!Array.isArray(ingredients)) {
    res.status(400).json({ error: "ingredients must be an array." });
    return;
  }

  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query("BEGIN");
    inTransaction = true;

    // Verify menu item exists
    const menuRes = await client.query("SELECT id, name FROM menu_items WHERE id = $1", [menuItemId]);
    if (menuRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Menu item not found." });
      return;
    }

    // Delete existing recipe ingredients for this menu item
    await client.query("DELETE FROM menu_item_recipes WHERE menu_item_id = $1", [menuItemId]);

    // Insert new ingredients
    for (const ing of ingredients) {
      const rmId = parseInt(String(ing.rawMaterialId), 10);
      const qty = parseFloat(String(ing.quantity));
      const ingUnit = normalizeUnit(String(ing.unit || ""));

      if (!rmId || isNaN(qty) || qty <= 0) {
        throw new Error("Each ingredient must have a valid rawMaterialId and quantity > 0.");
      }

      // Check raw material existence, active status, and unit compatibility
      const rmRes = await client.query("SELECT id, name, base_unit, is_archived FROM raw_materials WHERE id = $1", [rmId]);
      if (rmRes.rows.length === 0) {
        throw new Error(`Raw material with ID ${rmId} not found.`);
      }

      const rm = rmRes.rows[0];
      if (rm.is_archived) {
        throw new Error(`Cannot add archived raw material "${rm.name}" to recipe. Please restore it first.`);
      }
      if (!areUnitsCompatible(ingUnit, rm.base_unit)) {
        throw new Error(
          `Unit "${ingUnit}" for "${rm.name}" is incompatible with its base unit "${rm.base_unit}".`
        );
      }

      await client.query(
        `INSERT INTO menu_item_recipes (menu_item_id, raw_material_id, quantity, unit, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [menuItemId, rmId, qty, ingUnit, ing.notes ? String(ing.notes).trim() : null]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true, menuItemId, ingredientCount: ingredients.length });
  } catch (err: any) {
    if (inTransaction) await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ error: "Failed to save recipe", details: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 11. ORDER TRANSACTIONAL DEDUCTION & REVERSAL HELPERS
// (Called during order placement and cancellation)
// ==========================================

/**
 * Deducts raw materials for an order strictly according to configured recipes.
 * Never guesses ingredient quantities. Idempotent and transactional.
 */
export async function deductOrderRawMaterials(
  client: any,
  orderId: number,
  orderItems: Array<{ menuItemId?: number; menu_item_id?: number; name?: string; item_name?: string; quantity: number }>,
  isAppend: boolean = false
): Promise<void> {
  // Check if raw materials have already been deducted for this order (skip check if appending new items)
  const orderRes = await client.query("SELECT id, raw_materials_deducted FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
  if (orderRes.rows.length === 0 || (!isAppend && orderRes.rows[0].raw_materials_deducted)) {
    return;
  }

  // Aggregate needed raw materials across all ordered items
  const rmReqMap = new Map<number, { rawMaterialId: number; baseQuantity: number; itemBreakdown: string[] }>();

  for (const item of orderItems) {
    let mId = item.menuItemId || item.menu_item_id;
    const qty = Math.max(1, Number(item.quantity) || 1);
    const itemName = (item.name || item.item_name || "").trim();

    if (!mId && itemName) {
      const nameRes = await client.query("SELECT id FROM menu_items WHERE LOWER(name) = LOWER($1) LIMIT 1", [itemName]);
      if (nameRes.rows.length > 0) mId = nameRes.rows[0].id;
    }

    if (!mId) continue;

    // Fetch configured recipe ingredients for this menu item
    const recipeRes = await client.query(
      `SELECT mir.raw_material_id, mir.quantity, mir.unit, r.name AS rm_name, r.base_unit
       FROM menu_item_recipes mir
       JOIN raw_materials r ON mir.raw_material_id = r.id
       WHERE mir.menu_item_id = $1 AND r.is_archived = false`,
      [mId]
    );

    // If no recipe configured, strictly DO NOT guess or deduct raw materials
    if (recipeRes.rows.length === 0) {
      continue;
    }

    for (const rec of recipeRes.rows) {
      const baseQtyPerServing = convertUnitQuantity(rec.quantity, rec.unit, rec.base_unit);
      const totalBaseQty = baseQtyPerServing * qty;

      const existing = rmReqMap.get(rec.raw_material_id);
      if (existing) {
        existing.baseQuantity += totalBaseQty;
        existing.itemBreakdown.push(`${itemName} x${qty}`);
      } else {
        rmReqMap.set(rec.raw_material_id, {
          rawMaterialId: rec.raw_material_id,
          baseQuantity: totalBaseQty,
          itemBreakdown: [`${itemName} x${qty}`],
        });
      }
    }
  }

  // If no ordered items have configured recipes, we simply mark processed and return
  if (rmReqMap.size === 0) {
    await client.query("UPDATE orders SET raw_materials_deducted = true WHERE id = $1", [orderId]);
    return;
  }

  // Lock raw material rows for transactional deduction
  const rmIds = Array.from(rmReqMap.keys());
  const rmRes = await client.query(
    `SELECT id, name, base_unit, current_stock FROM raw_materials WHERE id = ANY($1) FOR UPDATE`,
    [rmIds]
  );

  // 1. Verify sufficient stock on hand for all required raw materials
  for (const rm of rmRes.rows) {
    const req = rmReqMap.get(rm.id);
    if (!req) continue;

    const currentStock = parseFloat(rm.current_stock || "0");
    if (currentStock < req.baseQuantity) {
      const err: any = new Error(
        `Insufficient raw material stock for "${rm.name}". Need ${req.baseQuantity} ${rm.base_unit}, but only ${currentStock} ${rm.base_unit} available.`
      );
      err.status = 400;
      err.code = "INSUFFICIENT_RAW_MATERIAL_STOCK";
      err.rawMaterialId = rm.id;
      throw err;
    }
  }

  // 2. Atomically deduct and record audit movement records
  for (const rm of rmRes.rows) {
    const req = rmReqMap.get(rm.id);
    if (!req) continue;

    const currentStock = parseFloat(rm.current_stock || "0");
    const newBalance = Math.round((currentStock - req.baseQuantity) * 1000) / 1000;

    await client.query("UPDATE raw_materials SET current_stock = $1, updated_at = NOW() WHERE id = $2", [
      newBalance,
      rm.id,
    ]);

    await client.query(
      `INSERT INTO raw_material_movements (
        raw_material_id, movement_type, quantity, unit, base_quantity,
        balance_before, balance_after, reason, order_id, performed_by, created_at
      ) VALUES ($1, 'recipe_consumption', $2, $3, $4, $5, $6, $7, $8, 'order_system', NOW())`,
      [
        rm.id,
        req.baseQuantity,
        rm.base_unit,
        req.baseQuantity,
        currentStock,
        newBalance,
        isAppend
          ? `Recipe consumption for Order #${orderId} (Appended: ${req.itemBreakdown.join(", ")})`
          : `Recipe consumption for Order #${orderId} (${req.itemBreakdown.join(", ")})`,
        orderId,
      ]
    );
  }

  await client.query("UPDATE orders SET raw_materials_deducted = true WHERE id = $1", [orderId]);
}

/**
 * Reverses recipe-based raw material deductions when an order is cancelled.
 */
export async function reverseOrderRawMaterials(
  client: any,
  orderId: number,
  performedBy: string = "order_cancellation"
): Promise<void> {
  const orderRes = await client.query(
    "SELECT id, raw_materials_deducted FROM orders WHERE id = $1 FOR UPDATE",
    [orderId]
  );
  if (orderRes.rows.length === 0 || !orderRes.rows[0].raw_materials_deducted) {
    return;
  }

  // Fetch all recipe_consumption movements recorded for this order
  const movRes = await client.query(
    `SELECT rmm.raw_material_id, rmm.base_quantity, r.name, r.base_unit, r.current_stock
     FROM raw_material_movements rmm
     JOIN raw_materials r ON rmm.raw_material_id = r.id
     WHERE rmm.order_id = $1 AND rmm.movement_type = 'recipe_consumption'
     FOR UPDATE OF r`,
    [orderId]
  );

  for (const mov of movRes.rows) {
    const currentStock = parseFloat(mov.current_stock || "0");
    const returnQty = parseFloat(mov.base_quantity || "0");
    const newBalance = Math.round((currentStock + returnQty) * 1000) / 1000;

    await client.query("UPDATE raw_materials SET current_stock = $1, updated_at = NOW() WHERE id = $2", [
      newBalance,
      mov.raw_material_id,
    ]);

    await client.query(
      `INSERT INTO raw_material_movements (
        raw_material_id, movement_type, quantity, unit, base_quantity,
        balance_before, balance_after, reason, order_id, performed_by, created_at
      ) VALUES ($1, 'order_reversal', $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        mov.raw_material_id,
        returnQty,
        mov.base_unit,
        returnQty,
        currentStock,
        newBalance,
        `Reversal for cancelled Order #${orderId}`,
        orderId,
        performedBy,
      ]
    );
  }

  await client.query("UPDATE orders SET raw_materials_deducted = false WHERE id = $1", [orderId]);
}

export default router;
