import { Order, CustomerStats } from "./types";
import { isCancelledOrder } from "./revenue";

export function calculateCustomerStats(orders: Order[]): CustomerStats {
  const customerCounts: Record<string, number> = {};
  let anonymousCount = 0;

  // Only count non-cancelled orders for customer metrics
  const validOrders = orders.filter((o) => !isCancelledOrder(o));

  validOrders.forEach((order) => {
    const rawName = order.customer_name || order.customerName || "";
    const name = rawName.trim().toLowerCase();

    if (name) {
      customerCounts[name] = (customerCounts[name] || 0) + 1;
    } else {
      // Treat each anonymous order as a distinct one-time customer
      anonymousCount += 1;
    }
  });

  const totalNamedCustomers = Object.keys(customerCounts).length;
  const returningCustomers = Object.values(customerCounts).filter(
    (count) => count > 1
  ).length;

  const totalCustomers = totalNamedCustomers + anonymousCount;
  const newCustomers = totalNamedCustomers - returningCustomers + anonymousCount;
  const repeatPurchaseRate =
    totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

  return {
    totalCustomers,
    returningCustomers,
    newCustomers,
    repeatPurchaseRate,
  };
}
