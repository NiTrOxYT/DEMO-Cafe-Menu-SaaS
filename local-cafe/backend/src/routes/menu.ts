import { Router, Request, Response } from "express";
import crypto from "crypto";
import { query } from "../db/index.js";
import { requireAdmin } from "../lib/auth.js";
import { requireCustomerLocationOrAdmin } from "../lib/location.js";

const router = Router();

// ==========================================
// CATEGORIES
// ==========================================

// GET /api/categories
router.get("/categories", requireCustomerLocationOrAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await query("SELECT id, name, sort_order FROM categories ORDER BY sort_order ASC, id ASC");
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch categories", details: err.message });
  }
});

// POST /api/categories (Admin only)
router.post("/categories", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, sort_order } = req.body || {};
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Category name is required." });
      return;
    }

    const sortOrder = typeof sort_order === "number" ? sort_order : 0;
    const result = await query(
      "INSERT INTO categories (name, sort_order) VALUES ($1, $2) RETURNING id, name, sort_order",
      [name.trim(), sortOrder]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create category", details: err.message });
  }
});

// PATCH /api/categories/:id (Admin only)
router.patch("/categories/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const { name, sort_order } = req.body || {};

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(String(name).trim());
    }
    if (sort_order !== undefined) {
      updates.push(`sort_order = $${idx++}`);
      values.push(Number(sort_order));
    }

    if (updates.length === 0) {
      res.status(400).json({ error: "No fields provided to update." });
      return;
    }

    values.push(id);
    const result = await query(
      `UPDATE categories SET ${updates.join(", ")} WHERE id = $${idx} RETURNING id, name, sort_order`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Category not found." });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update category", details: err.message });
  }
});

// DELETE /api/categories/:id (Admin only)
router.delete("/categories/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);

    // Check if items reference this category
    const countRes = await query("SELECT count(*) AS count FROM menu_items WHERE category_id = $1", [id]);
    if (parseInt(countRes.rows[0]?.count || "0", 10) > 0) {
      res.status(400).json({ error: "Cannot delete category with associated menu items. Reassign or delete items first." });
      return;
    }

    const result = await query("DELETE FROM categories WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Category not found." });
      return;
    }

    res.json({ success: true, message: "Category deleted", id });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete category", details: err.message });
  }
});

// ==========================================
// MENU ITEMS
// ==========================================

// GET /api/menu/summary
router.get("/menu/summary", async (_req: Request, res: Response) => {
  try {
    const itemsRes = await query("SELECT count(*) as total, count(*) FILTER (WHERE available = true) as available FROM menu_items");
    const catRes = await query("SELECT count(*) as total FROM categories");

    res.json({
      totalItems: parseInt(itemsRes.rows[0]?.total || "0", 10),
      totalCategories: parseInt(catRes.rows[0]?.total || "0", 10),
      availableItems: parseInt(itemsRes.rows[0]?.available || "0", 10),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get menu summary", details: err.message });
  }
});

// GET /api/menu
router.get("/menu", requireCustomerLocationOrAdmin, async (req: Request, res: Response) => {
  try {
    const { categoryId, available } = req.query;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (categoryId !== undefined && categoryId !== null && categoryId !== "") {
      conditions.push(`m.category_id = $${idx++}`);
      values.push(parseInt(String(categoryId), 10));
    }

    if (available !== undefined && available !== null && available !== "") {
      conditions.push(`m.available = $${idx++}`);
      values.push(String(available) === "true");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT 
        m.id,
        m.name,
        m.description,
        m.price,
        m.image_url AS "imageUrl",
        m.category_id AS "categoryId",
        c.name AS "categoryName",
        m.available,
        m.sort_order AS "sortOrder",
        m.is_veg AS "isVeg",
        m.is_bestseller AS "isBestseller",
        m.is_spicy AS "isSpicy",
        m.track_inventory AS "trackInventory",
        m.inventory_quantity AS "inventoryQuantity",
        m.inventory_unit AS "inventoryUnit",
        m.low_stock_threshold AS "lowStockThreshold",
        m.created_at AS "createdAt",
        COALESCE(review_stats.review_count, 0)::INTEGER AS "reviewCount",
        COALESCE(review_stats.average_rating, 0)::DOUBLE PRECISION AS "averageRating"
      FROM menu_items m
      INNER JOIN categories c ON m.category_id = c.id
      LEFT JOIN (
        SELECT menu_item_id,
               COUNT(*)::INTEGER AS review_count,
               ROUND(AVG(rating)::numeric, 1) AS average_rating
        FROM menu_item_reviews
        GROUP BY menu_item_id
      ) review_stats ON review_stats.menu_item_id = m.id
      ${whereClause}
      ORDER BY m.sort_order ASC, m.id ASC
    `;

    const result = await query(sql, values);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch menu items", details: err.message });
  }
});

// GET /api/menu/:id/reviews
router.get("/menu/:id/reviews", requireCustomerLocationOrAdmin, async (req: Request, res: Response) => {
  try {
    const menuItemId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(menuItemId) || menuItemId < 1) {
      res.status(400).json({ error: "Invalid menu item id." });
      return;
    }

    const reviewerKey = String(req.headers["x-reviewer-key"] || "");
    const reviewerKeyHash = /^[0-9a-f-]{36}$/i.test(reviewerKey)
      ? crypto.createHash("sha256").update(reviewerKey).digest("hex")
      : null;
    const [reviewsResult, ownReviewResult] = await Promise.all([
      query(
        `SELECT rating, review_text AS "reviewText", created_at AS "createdAt"
         FROM menu_item_reviews
         WHERE menu_item_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [menuItemId]
      ),
      reviewerKeyHash
        ? query(
            `SELECT rating, review_text AS "reviewText", created_at AS "createdAt"
             FROM menu_item_reviews
             WHERE menu_item_id = $1 AND reviewer_key_hash = $2`,
            [menuItemId, reviewerKeyHash]
          )
        : Promise.resolve({ rows: [] } as any),
    ]);

    res.json({ reviews: reviewsResult.rows, myReview: ownReviewResult.rows[0] || null });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch item reviews", details: err.message });
  }
});

// POST /api/menu/:id/reviews — one editable review per item and browser identity.
router.post("/menu/:id/reviews", requireCustomerLocationOrAdmin, async (req: Request, res: Response) => {
  try {
    const menuItemId = Number.parseInt(String(req.params.id), 10);
    const { rating, reviewText = "", reviewerKey } = req.body || {};
    const numericRating = Number(rating);
    const text = typeof reviewText === "string" ? reviewText.trim() : "";

    if (!Number.isInteger(menuItemId) || menuItemId < 1) {
      res.status(400).json({ error: "Invalid menu item id." });
      return;
    }
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      res.status(400).json({ error: "Choose a rating from 1 to 5 stars." });
      return;
    }
    if (text.length > 500) {
      res.status(400).json({ error: "Review text must be 500 characters or fewer." });
      return;
    }
    if (typeof reviewerKey !== "string" || !/^[0-9a-f-]{36}$/i.test(reviewerKey)) {
      res.status(400).json({ error: "A valid reviewer identity is required." });
      return;
    }

    const reviewerKeyHash = crypto.createHash("sha256").update(reviewerKey).digest("hex");
    const savedResult = await query(
      `INSERT INTO menu_item_reviews (menu_item_id, reviewer_key_hash, rating, review_text)
       SELECT $1, $2, $3, $4
       WHERE EXISTS (SELECT 1 FROM menu_items WHERE id = $1 AND available = TRUE)
       ON CONFLICT (menu_item_id, reviewer_key_hash)
       DO UPDATE SET rating = EXCLUDED.rating,
                     review_text = EXCLUDED.review_text,
                     updated_at = NOW()
       RETURNING rating, review_text AS "reviewText", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [menuItemId, reviewerKeyHash, numericRating, text]
    );

    if (savedResult.rows.length === 0) {
      res.status(404).json({ error: "Available menu item not found." });
      return;
    }

    const summaryResult = await query(
      `SELECT COUNT(*)::INTEGER AS "reviewCount",
              ROUND(AVG(rating)::numeric, 1)::DOUBLE PRECISION AS "averageRating"
       FROM menu_item_reviews WHERE menu_item_id = $1`,
      [menuItemId]
    );
    res.status(201).json({
      review: savedResult.rows[0],
      ...summaryResult.rows[0],
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save item review", details: err.message });
  }
});

// POST /api/menu (Admin only)
router.post("/menu", requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      price,
      imageUrl,
      categoryId,
      available = true,
      sortOrder = 0,
      isVeg = true,
      isBestseller = false,
      isSpicy = false,
      trackInventory = false,
      inventoryQuantity = 0,
      inventoryUnit = "portions",
      lowStockThreshold = 5,
    } = req.body || {};

    if (!name || price === undefined || !categoryId) {
      res.status(400).json({ error: "Name, price, and categoryId are required." });
      return;
    }

    const qty = Math.max(0, Number(inventoryQuantity) || 0);
    const result = await query(
      `INSERT INTO menu_items (
        name, description, price, image_url, category_id, available, sort_order, is_veg, is_bestseller, is_spicy,
        track_inventory, inventory_quantity, inventory_unit, low_stock_threshold
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING 
        id, name, description, price, image_url AS "imageUrl", category_id AS "categoryId",
        available, sort_order AS "sortOrder", is_veg AS "isVeg", is_bestseller AS "isBestseller", is_spicy AS "isSpicy",
        track_inventory AS "trackInventory", inventory_quantity AS "inventoryQuantity",
        inventory_unit AS "inventoryUnit", low_stock_threshold AS "lowStockThreshold"`,
      [
        name.trim(),
        description || null,
        Number(price),
        imageUrl || null,
        Number(categoryId),
        Boolean(available),
        Number(sortOrder),
        Boolean(isVeg),
        Boolean(isBestseller),
        Boolean(isSpicy),
        Boolean(trackInventory),
        qty,
        String(inventoryUnit || "portions").trim(),
        Math.max(0, Number(lowStockThreshold) || 5),
      ]
    );

    const createdItem = result.rows[0];

    // If opening stock provided with tracking enabled, record initial movement
    if (Boolean(trackInventory) && qty > 0) {
      const adminEmail = (req as any).admin?.email || "admin";
      await query(
        `INSERT INTO inventory_movements (
          menu_item_id, movement_type, quantity, balance_after, unit, reason, performed_by, created_at
        ) VALUES ($1, 'opening_stock', $2, $3, $4, 'Opening stock on creation', $5, NOW())`,
        [createdItem.id, qty, qty, createdItem.inventoryUnit, adminEmail]
      );
    }

    res.status(201).json(createdItem);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create menu item", details: err.message });
  }
});

// PATCH /api/menu/:id (Admin only)
router.patch("/menu/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const {
      name,
      description,
      price,
      imageUrl,
      categoryId,
      available,
      sortOrder,
      isVeg,
      isBestseller,
      isSpicy,
      trackInventory,
      inventoryQuantity,
      inventoryUnit,
      lowStockThreshold,
    } = req.body || {};

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(String(name).trim()); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
    if (price !== undefined) { updates.push(`price = $${idx++}`); values.push(Number(price)); }
    if (imageUrl !== undefined) { updates.push(`image_url = $${idx++}`); values.push(imageUrl); }
    if (categoryId !== undefined) { updates.push(`category_id = $${idx++}`); values.push(Number(categoryId)); }
    if (available !== undefined) { updates.push(`available = $${idx++}`); values.push(Boolean(available)); }
    if (sortOrder !== undefined) { updates.push(`sort_order = $${idx++}`); values.push(Number(sortOrder)); }
    if (isVeg !== undefined) { updates.push(`is_veg = $${idx++}`); values.push(Boolean(isVeg)); }
    if (isBestseller !== undefined) { updates.push(`is_bestseller = $${idx++}`); values.push(Boolean(isBestseller)); }
    if (isSpicy !== undefined) { updates.push(`is_spicy = $${idx++}`); values.push(Boolean(isSpicy)); }
    if (trackInventory !== undefined) { updates.push(`track_inventory = $${idx++}`); values.push(Boolean(trackInventory)); }
    if (inventoryQuantity !== undefined) { updates.push(`inventory_quantity = $${idx++}`); values.push(Math.max(0, Number(inventoryQuantity))); }
    if (inventoryUnit !== undefined) { updates.push(`inventory_unit = $${idx++}`); values.push(String(inventoryUnit).trim()); }
    if (lowStockThreshold !== undefined) { updates.push(`low_stock_threshold = $${idx++}`); values.push(Math.max(0, Number(lowStockThreshold))); }

    if (updates.length === 0) {
      res.status(400).json({ error: "No fields provided to update." });
      return;
    }

    values.push(id);
    const result = await query(
      `UPDATE menu_items SET ${updates.join(", ")} WHERE id = $${idx}
       RETURNING id, name, description, price, image_url AS "imageUrl", category_id AS "categoryId",
       available, sort_order AS "sortOrder", is_veg AS "isVeg", is_bestseller AS "isBestseller", is_spicy AS "isSpicy",
       track_inventory AS "trackInventory", inventory_quantity AS "inventoryQuantity",
       inventory_unit AS "inventoryUnit", low_stock_threshold AS "lowStockThreshold"`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Menu item not found." });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update menu item", details: err.message });
  }
});

// DELETE /api/menu/:id (Admin only)
router.delete("/menu/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!id) {
      res.status(400).json({ error: "Invalid menu item ID." });
      return;
    }

    // Check if menu item has order history or recipes
    const [orderCheck, recipeCheck] = await Promise.all([
      query("SELECT COUNT(*) FROM order_items WHERE menu_item_id = $1", [id]),
      query("SELECT COUNT(*) FROM menu_item_recipes WHERE menu_item_id = $1", [id]),
    ]);

    const orderCount = parseInt(orderCheck.rows[0]?.count || "0", 10);
    const recipeCount = parseInt(recipeCheck.rows[0]?.count || "0", 10);

    if (orderCount > 0 || recipeCount > 0) {
      // Preserve historical orders and recipe configuration: mark unavailable instead of deleting
      await query("UPDATE menu_items SET available = false WHERE id = $1", [id]);
      res.json({
        success: true,
        message: "Menu item has order history or recipes. Marked as unavailable to preserve audit history.",
        id,
        archived: true,
      });
      return;
    }

    const result = await query("DELETE FROM menu_items WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Menu item not found." });
      return;
    }
    res.json({ success: true, message: "Menu item deleted", id });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete menu item", details: err.message });
  }
});

export default router;

