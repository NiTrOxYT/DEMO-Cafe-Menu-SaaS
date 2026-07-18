import { Order, Category, MenuItem, RangeKey, AnalyticsResult, ItemStat, TableStat } from "./types";
import { getComparisonWindows, getOrderDate, isSameDay } from "./date-utils";
import {
  calculateRevenueStats,
  getOrderTotal,
  isCompletedOrder,
  isCancelledOrder,
  isActiveOrder,
  isRevenueOrder,
} from "./revenue";
import { calculateCustomerStats } from "./customers";
import { calculateCategoryStats } from "./categories";
import { generateDayTrend, generateHourlyDemand } from "./charts";
import { validateAnalytics } from "./validation";

export function calculateAnalytics(
  orders: Order[],
  categories: Category[],
  menuItems: MenuItem[],
  range: RangeKey
): AnalyticsResult {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const { currentStart, currentEnd, prevStart, prevEnd } = getComparisonWindows(range);

  // 1. Scoped Orders for Current Period
  const scopedOrders = orders.filter((order) => {
    const date = getOrderDate(order);
    if (currentStart && date < currentStart) return false;
    if (currentEnd && date > currentEnd) return false;
    return true;
  });

  // 2. Filter Active & Completed
  const activeOrders = scopedOrders.filter(isActiveOrder);
  const completedOrders = scopedOrders.filter(isCompletedOrder);

  // 3. Compute Financial Metrics
  const revenueStats = calculateRevenueStats(scopedOrders);

  // 4. Today vs Yesterday Revenue & Period-over-period Delta
  const todayRevenue = orders
    .filter((order) => isSameDay(getOrderDate(order), now) && isRevenueOrder(order))
    .reduce((sum, order) => sum + getOrderTotal(order), 0);

  const yesterdayRevenue = orders
    .filter((order) => isSameDay(getOrderDate(order), yesterday) && isRevenueOrder(order))
    .reduce((sum, order) => sum + getOrderTotal(order), 0);

  const currentPeriodPaidRevenue = orders
    .filter((order) => {
      const date = getOrderDate(order);
      if (currentStart && date < currentStart) return false;
      if (currentEnd && date > currentEnd) return false;
      return isRevenueOrder(order);
    })
    .reduce((sum, order) => sum + getOrderTotal(order), 0);

  const prevPeriodPaidRevenue = orders
    .filter((order) => {
      const date = getOrderDate(order);
      if (prevStart && date < prevStart) return false;
      if (prevEnd && date > prevEnd) return false;
      return isRevenueOrder(order);
    })
    .reduce((sum, order) => sum + getOrderTotal(order), 0);

  const revenueDelta = prevPeriodPaidRevenue > 0
    ? ((currentPeriodPaidRevenue - prevPeriodPaidRevenue) / prevPeriodPaidRevenue) * 100
    : currentPeriodPaidRevenue > 0
      ? 100
      : 0;

  // 5. Avg Items & Rates
  let totalItemsCount = 0;
  const itemStats: Record<
    string,
    { name: string; quantity: number; revenue: number; orders: number }
  > = {};
  const tableStats: Record<
    string,
    { table: string; orders: number; revenue: number }
  > = {};
  const statusStats: Record<string, number> = {};

  scopedOrders.forEach((order) => {
    if (!order || typeof order !== "object" || typeof order.id !== "number") {
      if (import.meta.env.DEV) {
        console.warn("Skipping malformed order record:", order);
      }
      return;
    }

    const status = order.status || "unknown";
    statusStats[status] = (statusStats[status] || 0) + 1;

    // Table Stats
    const table = String(order.table_id ?? order.tableNumber ?? "Walk-in");
    tableStats[table] = tableStats[table] || { table, orders: 0, revenue: 0 };
    tableStats[table].orders += 1;
    if (!isCancelledOrder(order)) {
      tableStats[table].revenue += getOrderTotal(order);
    }

    const orderItemNames = new Set<string>();

    order.order_items?.forEach((item) => {
      if (!item || typeof item !== "object") {
        if (import.meta.env.DEV) {
          console.warn(`Skipping malformed order item in order #${order.id}`, item);
        }
        return;
      }

      const name = (item.item_name || item.name || item.menu_items?.name || "Unknown item").trim();
      const qty = Number(item.quantity ?? 1);
      const price = Number(item.price ?? 0);
      const lineRevenue = price * qty;

      totalItemsCount += qty;

      itemStats[name] = itemStats[name] || {
        name,
        quantity: 0,
        revenue: 0,
        orders: 0,
      };

      itemStats[name].quantity += qty;
      if (!isCancelledOrder(order)) {
        itemStats[name].revenue += lineRevenue;
      }
      orderItemNames.add(name);
    });

    orderItemNames.forEach((name) => {
      itemStats[name].orders += 1;
    });
  });

  const avgItems = scopedOrders.length ? totalItemsCount / scopedOrders.length : 0;
  const completionRate = scopedOrders.length
    ? (completedOrders.length / scopedOrders.length) * 100
    : 0;

  // 6. Winners, Tables & Demand
  const revenueItems = Object.values(itemStats).sort((a, b) => b.revenue - a.revenue);
  const quantityItems = Object.values(itemStats).sort((a, b) => b.quantity - a.quantity);
  const topTables = Object.values(tableStats)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const hourlyDemandRaw = generateHourlyDemand(scopedOrders);
  const peakHour =
    [...hourlyDemandRaw].sort((a, b) => b.orders - a.orders)[0]?.hour || "No peak";

  const dayTrend = generateDayTrend(scopedOrders, range);
  const statusMix = Object.entries(statusStats).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    key: name,
    value,
  }));

  const highValueOrders = [...scopedOrders]
    .sort((a, b) => getOrderTotal(b) - getOrderTotal(a))
    .slice(0, 5);

  // 7. Customer Metrics
  const customers = calculateCustomerStats(scopedOrders);

  // 8. Category Metrics
  const categoryStats = calculateCategoryStats(scopedOrders, categories, menuItems);

  const result: AnalyticsResult = {
    scopedOrders,
    activeOrders,
    completedOrders,
    revenue: revenueStats.paidRevenue, // legacy alias
    grossRevenue: revenueStats.grossRevenue,
    paidRevenue: revenueStats.paidRevenue,
    pendingRevenue: revenueStats.pendingRevenue,
    cancelledValue: revenueStats.cancelledValue,
    todayRevenue,
    yesterdayRevenue,
    revenueDelta,
    avgOrder: revenueStats.avgOrder,
    avgItems,
    completionRate,
    topItem: revenueItems[0],
    topTables,
    peakHour,
    dayTrend,
    statusMix,
    hourlyDemand: hourlyDemandRaw.slice(-12),
    revenueItems: revenueItems.slice(0, 8),
    quantityItems: quantityItems.slice(0, 8),
    highValueOrders,
    customers,
    categories: categoryStats,
  };

  // Run validation checks
  validateAnalytics(result);

  return result;
}
