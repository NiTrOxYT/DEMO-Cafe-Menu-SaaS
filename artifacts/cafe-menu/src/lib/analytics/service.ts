import { supabase } from "@/lib/supabase";
import { RangeKey, Order, Category, MenuItem, AnalyticsResult } from "./types";
import { calculateAnalytics } from "./calculations";

const ANALYTICS_READ_TIMEOUT_MS = 6000;

export class AnalyticsService {
  /**
   * Fetches, processes, and normalizes analytics for the given range and tenant/location.
   */
  static async getReport(
    range: RangeKey,
    cafeId?: number | string | null
  ): Promise<AnalyticsResult> {
    const t0 = performance.now();
    const now = new Date();

    // 1. Build Query with Range Bounds and Tenant Filtering
    let query = supabase.from("orders").select(`
      *,
      order_items (
        *,
        menu_items (
          name
        )
      )
    `);

    // Tenant / Multi-café Filter
    if (cafeId !== undefined && cafeId !== null) {
      query = query.eq("cafe_id", cafeId);
    }

    if (range !== "all") {
      let fetchStart: Date;
      if (range === "today") {
        fetchStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      } else if (range === "yesterday") {
        fetchStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
      } else if (range === "7d") {
        fetchStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
      } else if (range === "30d") {
        fetchStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 59);
      } else if (range === "thisMonth") {
        fetchStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      } else if (range === "prevMonth") {
        fetchStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      } else {
        fetchStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      }
      query = query.gte("created_at", fetchStart.toISOString());
    }

    query = query.order("created_at", { ascending: false });

    // 2. Load Datasets in Parallel with Timeout Guard
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error("Analytics read query timed out")),
        ANALYTICS_READ_TIMEOUT_MS
      );
    });

    const [ordersRes, categoriesRes, menuItemsRes] = await Promise.race([
      Promise.all([
        query,
        supabase.from("categories").select("id, name"),
        supabase.from("menu_items").select("id, name, category_id"),
      ]),
      timeout,
    ]);

    const t1 = performance.now();

    if (ordersRes.error) throw ordersRes.error;
    if (categoriesRes.error) throw categoriesRes.error;
    if (menuItemsRes.error) throw menuItemsRes.error;

    const rawOrders = (ordersRes.data || []) as Order[];
    const categories = (categoriesRes.data || []) as Category[];
    const menuItems = (menuItemsRes.data || []) as MenuItem[];

    // 3. Orchestrate Calculations
    const t2 = performance.now();
    const result = calculateAnalytics(rawOrders, categories, menuItems, range);
    const t3 = performance.now();

    // 4. Populate Diagnostics Stats
    const fetchTimeMs = Math.round(t1 - t0);
    const calcTimeMs = Math.round(t3 - t2);
    const processedCount = rawOrders.length;

    const report: AnalyticsResult = {
      ...result,
      fetchTimeMs,
      calcTimeMs,
      processedCount,
    };

    // 5. Developer Observability Diagnostics Group
    if (import.meta.env.DEV) {
      console.groupCollapsed("📊 [Analytics Performance Diagnostics]");
      console.log(`⏱️ Total Time: ${Math.round(t3 - t0)}ms`);
      console.log(`📡 Fetch Time: ${fetchTimeMs}ms`);
      console.log(`🧮 Process Time: ${calcTimeMs}ms`);
      console.log(`📦 Orders Loaded: ${processedCount}`);
      console.groupEnd();
    }

    return report;
  }
}
