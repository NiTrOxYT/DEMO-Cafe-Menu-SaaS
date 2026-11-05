import { Router, Request, Response } from "express";
import { query } from "../db/index.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

async function getOrCreateSettings() {
  const existing = await query("SELECT * FROM restaurant_settings LIMIT 1");
  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const created = await query(`
    INSERT INTO restaurant_settings (
      restaurant_name, address, whatsapp_number, opening_hours, logo_url, banner_url, primary_color, tagline
    ) VALUES (
      'The Golden Brew', '', '', 'Mon–Sun: 8 AM – 10 PM', NULL, NULL, '#c9a96e', 'Crafted with passion, served with love'
    ) RETURNING *
  `);
  return created.rows[0];
}

// GET /api/settings
router.get("/settings", async (_req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSettings();
    res.json({
      id: settings.id,
      restaurantName: settings.restaurant_name,
      address: settings.address,
      whatsappNumber: settings.whatsapp_number,
      openingHours: settings.opening_hours,
      logoUrl: settings.logo_url,
      bannerUrl: settings.banner_url,
      primaryColor: settings.primary_color,
      tagline: settings.tagline,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch settings", details: err.message });
  }
});

// PATCH /api/settings (Admin only)
router.patch("/settings", requireAdmin, async (req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSettings();
    const {
      restaurantName,
      address,
      whatsappNumber,
      openingHours,
      logoUrl,
      bannerUrl,
      primaryColor,
      tagline,
    } = req.body || {};

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (restaurantName !== undefined) { updates.push(`restaurant_name = $${idx++}`); values.push(restaurantName); }
    if (address !== undefined) { updates.push(`address = $${idx++}`); values.push(address); }
    if (whatsappNumber !== undefined) { updates.push(`whatsapp_number = $${idx++}`); values.push(whatsappNumber); }
    if (openingHours !== undefined) { updates.push(`opening_hours = $${idx++}`); values.push(openingHours); }
    if (logoUrl !== undefined) { updates.push(`logo_url = $${idx++}`); values.push(logoUrl); }
    if (bannerUrl !== undefined) { updates.push(`banner_url = $${idx++}`); values.push(bannerUrl); }
    if (primaryColor !== undefined) { updates.push(`primary_color = $${idx++}`); values.push(primaryColor); }
    if (tagline !== undefined) { updates.push(`tagline = $${idx++}`); values.push(tagline); }

    if (updates.length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }

    values.push(settings.id);
    const result = await query(
      `UPDATE restaurant_settings SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    const updated = result.rows[0];
    res.json({
      id: updated.id,
      restaurantName: updated.restaurant_name,
      address: updated.address,
      whatsappNumber: updated.whatsapp_number,
      openingHours: updated.opening_hours,
      logoUrl: updated.logo_url,
      bannerUrl: updated.banner_url,
      primaryColor: updated.primary_color,
      tagline: updated.tagline,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update settings", details: err.message });
  }
});

export default router;

