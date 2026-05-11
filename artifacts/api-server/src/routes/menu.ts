import { Router } from "express";
import { db } from "@workspace/db";
import { menuItemsTable, categoriesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateMenuItemBody,
  UpdateMenuItemBody,
  UpdateMenuItemParams,
  GetMenuItemParams,
  DeleteMenuItemParams,
  ListMenuItemsQueryParams,
} from "@workspace/api-zod";
import { sessions } from "./auth";

const router = Router();

function requireAdmin(req: any, res: any): boolean {
  const token = req.cookies?.admin_token;
  if (!token || !sessions.has(token)) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  return true;
}

router.get("/menu/summary", async (req, res) => {
  try {
    const items = await db.select().from(menuItemsTable);
    const categories = await db.select().from(categoriesTable);
    const availableItems = items.filter((i) => i.available).length;
    res.json({
      totalItems: items.length,
      totalCategories: categories.length,
      availableItems,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get menu summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/menu", async (req, res) => {
  const parsed = ListMenuItemsQueryParams.safeParse({
    categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
    available: req.query.available !== undefined ? req.query.available === "true" : undefined,
  });

  try {
    const conditions = [];
    if (parsed.success && parsed.data.categoryId !== undefined) {
      conditions.push(eq(menuItemsTable.categoryId, parsed.data.categoryId));
    }
    if (parsed.success && parsed.data.available !== undefined) {
      conditions.push(eq(menuItemsTable.available, parsed.data.available));
    }

    const items = await db
      .select({
        id: menuItemsTable.id,
        name: menuItemsTable.name,
        description: menuItemsTable.description,
        price: menuItemsTable.price,
        imageUrl: menuItemsTable.imageUrl,
        categoryId: menuItemsTable.categoryId,
        categoryName: categoriesTable.name,
        available: menuItemsTable.available,
        sortOrder: menuItemsTable.sortOrder,
      })
      .from(menuItemsTable)
      .leftJoin(categoriesTable, eq(menuItemsTable.categoryId, categoriesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(menuItemsTable.sortOrder);

    res.json(
      items.map((item) => ({
        ...item,
        price: Number(item.price),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list menu items");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/menu", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const parsed = CreateMenuItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    const [item] = await db
      .insert(menuItemsTable)
      .values({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        price: String(parsed.data.price),
        imageUrl: parsed.data.imageUrl ?? null,
        categoryId: parsed.data.categoryId,
        available: parsed.data.available ?? true,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning();

    const category = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, item.categoryId))
      .then((r) => r[0]);

    res.status(201).json({
      ...item,
      price: Number(item.price),
      categoryName: category?.name ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create menu item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/menu/:id", async (req, res) => {
  const parsed = GetMenuItemParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const [item] = await db
      .select({
        id: menuItemsTable.id,
        name: menuItemsTable.name,
        description: menuItemsTable.description,
        price: menuItemsTable.price,
        imageUrl: menuItemsTable.imageUrl,
        categoryId: menuItemsTable.categoryId,
        categoryName: categoriesTable.name,
        available: menuItemsTable.available,
        sortOrder: menuItemsTable.sortOrder,
      })
      .from(menuItemsTable)
      .leftJoin(categoriesTable, eq(menuItemsTable.categoryId, categoriesTable.id))
      .where(eq(menuItemsTable.id, parsed.data.id));

    if (!item) {
      res.status(404).json({ error: "Menu item not found" });
      return;
    }

    res.json({ ...item, price: Number(item.price) });
  } catch (err) {
    req.log.error({ err }, "Failed to get menu item" );
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/menu/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const paramsParsed = UpdateMenuItemParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const bodyParsed = UpdateMenuItemBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    const updateData: Record<string, unknown> = {};
    const b = bodyParsed.data;
    if (b.name !== undefined) updateData.name = b.name;
    if (b.description !== undefined) updateData.description = b.description;
    if (b.price !== undefined) updateData.price = String(b.price);
    if (b.imageUrl !== undefined) updateData.imageUrl = b.imageUrl;
    if (b.categoryId !== undefined) updateData.categoryId = b.categoryId;
    if (b.available !== undefined) updateData.available = b.available;
    if (b.sortOrder !== undefined) updateData.sortOrder = b.sortOrder;

    const [item] = await db
      .update(menuItemsTable)
      .set(updateData)
      .where(eq(menuItemsTable.id, paramsParsed.data.id))
      .returning();

    if (!item) {
      res.status(404).json({ error: "Menu item not found" });
      return;
    }

    const category = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, item.categoryId))
      .then((r) => r[0]);

    res.json({
      ...item,
      price: Number(item.price),
      categoryName: category?.name ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update menu item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/menu/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const parsed = DeleteMenuItemParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    await db.delete(menuItemsTable).where(eq(menuItemsTable.id, parsed.data.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete menu item");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
