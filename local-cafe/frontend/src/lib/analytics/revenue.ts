import { Order, RevenueStats } from "./types";

export function getOrderTotal(order: Order): number {
  const totalVal = order.total ?? order.total_amount ?? order.totalAmount ?? 0;
  const n = Number(totalVal);
  return Number.isFinite(n) ? n : 0;
}

export function isCompletedOrder(order: Order): boolean {
  return order.status === "completed";
}

export function isCancelledOrder(order: Order): boolean {
  return order.status === "cancelled";
}

export function isRevenueOrder(order: Order): boolean {
  // Paid or completed, and not cancelled
  if (isCancelledOrder(order)) return false;
  return order.is_paid === true || isCompletedOrder(order);
}

export function isActiveOrder(order: Order): boolean {
  if (isCancelledOrder(order) || isCompletedOrder(order)) return false;
  return ["pending", "preparing", "ready"].includes(order.status || "");
}

export function calculateRevenueStats(orders: Order[]): RevenueStats {
  let grossRevenue = 0;
  let paidRevenue = 0;
  let pendingRevenue = 0;
  let cancelledValue = 0;
  let paidOrdersCount = 0;

  orders.forEach((order) => {
    const amount = getOrderTotal(order);

    if (isCancelledOrder(order)) {
      cancelledValue += amount;
    } else {
      grossRevenue += amount;
      if (isRevenueOrder(order)) {
        paidRevenue += amount;
        paidOrdersCount += 1;
      } else {
        pendingRevenue += amount;
      }
    }
  });

  const avgOrder = paidOrdersCount > 0 ? paidRevenue / paidOrdersCount : 0;

  return {
    grossRevenue,
    paidRevenue,
    pendingRevenue,
    cancelledValue,
    avgOrder,
  };
}
