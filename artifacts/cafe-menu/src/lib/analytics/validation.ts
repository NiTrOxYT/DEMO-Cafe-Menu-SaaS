import { AnalyticsResult } from "./types";

export function validateAnalytics(data: AnalyticsResult): void {
  const warnings: string[] = [];

  // 1. Revenue should never be negative
  if (data.grossRevenue < 0) warnings.push(`Gross revenue is negative: ${data.grossRevenue}`);
  if (data.paidRevenue < 0) warnings.push(`Paid revenue is negative: ${data.paidRevenue}`);
  if (data.pendingRevenue < 0) warnings.push(`Pending revenue is negative: ${data.pendingRevenue}`);
  if (data.cancelledValue < 0) warnings.push(`Cancelled value is negative: ${data.cancelledValue}`);

  // 2. Category contribution should total approximately 100%
  if (data.categories.length > 0) {
    const sumPercent = data.categories.reduce((s, c) => s + c.percent, 0);
    if (Math.abs(sumPercent - 100) > 1.0) {
      warnings.push(`Category contribution totals ${sumPercent}%, which deviates from 100%`);
    }
  }

  // 3. Completed Orders <= Total Orders
  if (data.completedOrders.length > data.scopedOrders.length) {
    warnings.push(
      `Completed orders count (${data.completedOrders.length}) exceeds total orders (${data.scopedOrders.length})`
    );
  }

  // 4. Paid Revenue <= Gross Revenue
  if (data.paidRevenue > data.grossRevenue + 0.01) {
    warnings.push(`Paid revenue (${data.paidRevenue}) exceeds gross revenue (${data.grossRevenue})`);
  }

  // 5. Average Order Value should never return NaN or Infinity
  if (Number.isNaN(data.avgOrder) || !Number.isFinite(data.avgOrder)) {
    warnings.push(`Average order value is invalid: ${data.avgOrder}`);
  }

  // 6. Customer count should never exceed total orders
  if (data.customers.totalCustomers > data.scopedOrders.length) {
    warnings.push(
      `Customer count (${data.customers.totalCustomers}) exceeds total orders (${data.scopedOrders.length})`
    );
  }

  // 7. Chart-to-KPI reconciliation: sum of daily trend revenue must match paid revenue
  const trendRevenue = data.dayTrend.reduce((s, d) => s + d.revenue, 0);
  if (Math.abs(trendRevenue - data.paidRevenue) > 0.01) {
    warnings.push(
      `Reconciliation failed: Sum of trend revenue (₹${trendRevenue}) does not match paid revenue (₹${data.paidRevenue})`
    );
  }

  // 8. Chart-to-KPI reconciliation: sum of daily trend orders must match non-cancelled scoped orders
  const trendOrders = data.dayTrend.reduce((s, d) => s + d.orders, 0);
  const nonCancelledOrdersCount = data.scopedOrders.filter(o => o.status !== "cancelled").length;
  if (trendOrders !== nonCancelledOrdersCount) {
    warnings.push(
      `Reconciliation failed: Sum of trend orders (${trendOrders}) does not match active/completed orders count (${nonCancelledOrdersCount})`
    );
  }

  // 9. Category-to-KPI reconciliation: sum of category revenue must match paid revenue
  const categoryRevenue = data.categories.reduce((s, c) => s + c.revenue, 0);
  if (Math.abs(categoryRevenue - data.paidRevenue) > 1.0) {
    warnings.push(
      `Reconciliation failed: Sum of category revenue (₹${categoryRevenue}) does not match paid revenue (₹${data.paidRevenue})`
    );
  }

  // Log warnings during development
  if (warnings.length > 0) {
    console.groupCollapsed("📊 [Analytics Validation Warnings]");
    warnings.forEach((warn) => console.warn(`⚠️ ${warn}`));
    console.groupEnd();
  }
}
