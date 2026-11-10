import { Router, Request, Response } from "express";
import { query } from "../db/index.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

// ==========================================
// CATEGORIES
// ==========================================

// GET /api/categories
router.get("/categories", async (_req: Request, res: Response) => {
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
router.get("/menu", async (req: Request, res: Response) => {
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
        m.created_at AS "createdAt"
      FROM menu_items m
      INNER JOIN categories c ON m.category_id = c.id
      ${whereClause}
      ORDER BY m.sort_order ASC, m.id ASC
    `;

    const result = await query(sql, values);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch menu items", details: err.message });
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
    } = req.body || {};

    if (!name || price === undefined || !categoryId) {
      res.status(400).json({ error: "Name, price, and categoryId are required." });
      return;
    }

    const result = await query(
      `INSERT INTO menu_items (
        name, description, price, image_url, category_id, available, sort_order, is_veg, is_bestseller, is_spicy
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING 
        id, name, description, price, image_url AS "imageUrl", category_id AS "categoryId",
        available, sort_order AS "sortOrder", is_veg AS "isVeg", is_bestseller AS "isBestseller", is_spicy AS "isSpicy"`,
      [name.trim(), description || null, Number(price), imageUrl || null, Number(categoryId), Boolean(available), Number(sortOrder), Boolean(isVeg), Boolean(isBestseller), Boolean(isSpicy)]
    );

    res.status(201).json(result.rows[0]);
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

    if (updates.length === 0) {
      res.status(400).json({ error: "No fields provided to update." });
      return;
    }

    values.push(id);
    const result = await query(
      `UPDATE menu_items SET ${updates.join(", ")} WHERE id = $${idx}
       RETURNING id, name, description, price, image_url AS "imageUrl", category_id AS "categoryId",
       available, sort_order AS "sortOrder", is_veg AS "isVeg", is_bestseller AS "isBestseller", is_spicy AS "isSpicy"`,
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

