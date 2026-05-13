import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("restaurant_settings", {
  id: serial("id").primaryKey(),
  restaurantName: text("restaurant_name").notNull().default("The Golden Brew"),
  address: text("address"),
  whatsappNumber: text("whatsapp_number"),
  openingHours: text("opening_hours"),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  primaryColor: text("primary_color").notNull().default("#c9a96e"),
  tagline: text("tagline"),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
