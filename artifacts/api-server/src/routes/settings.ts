import { Router } from "express";
import { db, settingsTable } from "../lib/db";

const router = Router();

function requireAdmin(req: any, res: any): boolean {
  const token = req.cookies?.admin_token;
  if (token !== "authenticated") {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  return true;
}

async function getOrCreateSettings() {
  const rows = await db.select().from(settingsTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(settingsTable).values({}).returning();
  return created;
}

router.get("/settings", async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(settings);
  } catch (err) {
    req.log.error({ err }, "Failed to get settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/settings", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const settings = await getOrCreateSettings();
    const allowed = [
      "restaurantName",
      "address",
      "whatsappNumber",
      "openingHours",
      "logoUrl",
      "bannerUrl",
      "primaryColor",
      "tagline",
    ] as const;
    type SettingsKey = (typeof allowed)[number];
    const updateData: Partial<Record<SettingsKey, string>> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updateData[key] = String(req.body[key]);
    }
    if (Object.keys(updateData).length === 0) {
      res.json(settings);
      return;
    }
    const rows = await db.update(settingsTable).set(updateData).returning();
    res.json(rows[0] ?? settings);
  } catch (err) {
    req.log.error({ err }, "Failed to update settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
