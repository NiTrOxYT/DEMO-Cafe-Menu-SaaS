import { getAdminOrders, getCategories, getMenu } from "@/lib/api";
import { RangeKey, Category, MenuItem, AnalyticsResult } from "./types";
import { calculateAnalytics } from "./calculations";

export class AnalyticsService {
  /**
   * Fetches, processes, and normalizes analytics for the given range using local Express APIs.
   */
  static async getReport(
    range: RangeKey,
    _cafeId?: number | string | null,
    injectedCategories?: Category[],
    injectedMenuItems?: MenuItem[]
  ): Promise<AnalyticsResult> {
    const t0 = performance.now();

    const fetchCategories = async (): Promise<Category[]> => {
      if (injectedCategories && injectedCategories.length > 0) return injectedCategories;
      try {
        const data = await getCategories();
        return (data || []).map((c: any) => ({ id: c.id, name: c.name }));
      } catch {
        return [];
      }
    };

    const fetchMenuItems = async (): Promise<MenuItem[]> => {
      if (injectedMenuItems && injectedMenuItems.length > 0) return injectedMenuItems;
      try {
        const data = await getMenu();
        return (data || []).map((m: any) => ({
          id: m.id,
          name: m.name,
          price: Number(m.price || 0),
          category_id: m.categoryId ?? m.category_id ?? 0,
        }));
      } catch {
        return [];
      }
    };

    const [allOrders, categories, menuItems] = await Promise.all([
      getAdminOrders().catch(() => []),
      fetchCategories(),
      fetchMenuItems(),
    ]);

    const t1 = performance.now();

    // Filter by date range on client
    const now = new Date();
    let fetchStart: Date | null = null;

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
    }

    const filteredOrders = fetchStart
      ? (allOrders as any[]).filter((o) => new Date(o.created_at) >= fetchStart!)
      : (allOrders as any[]);

    const t2 = performance.now();
    const result = calculateAnalytics(filteredOrders, categories, menuItems, range);
    const t3 = performance.now();

    const report: AnalyticsResult = {
      ...result,
      fetchTimeMs: Math.round(t1 - t0),
      calcTimeMs: Math.round(t3 - t2),
      processedCount: filteredOrders.length,
    };

    return report;
  }
}
