import { Order, RangeKey, ChartDayTrend, ChartHourlyDemand } from "./types";
import { getOrderDate, formatDateKey, shortDate } from "./date-utils";
import { getOrderTotal, isCancelledOrder, isRevenueOrder } from "./revenue";

export function generateDayTrend(
  orders: Order[],
  range: RangeKey
): ChartDayTrend[] {
  const now = new Date();
  const dayStats: Record<
    string,
    { label: string; revenue: number; orders: number }
  > = {};

  let daysToShow = 7;
  let startDateForStats = new Date(now);

  if (range === "today") {
    daysToShow = 1;
    startDateForStats = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === "yesterday") {
    daysToShow = 1;
    startDateForStats = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1
    );
  } else if (range === "7d") {
    daysToShow = 7;
    startDateForStats = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6
    );
  } else if (range === "30d") {
    daysToShow = 30;
    startDateForStats = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 29
    );
  } else if (range === "thisMonth") {
    daysToShow = now.getDate();
    startDateForStats = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (range === "prevMonth") {
    const prevMonthYear =
      now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    daysToShow = new Date(prevMonthYear, prevMonth + 1, 0).getDate();
    startDateForStats = new Date(prevMonthYear, prevMonth, 1);
  } else {
    // all
    daysToShow = 14;
    startDateForStats = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 13
    );
  }

  for (let i = 0; i < daysToShow; i++) {
    const date = new Date(startDateForStats);
    date.setDate(startDateForStats.getDate() + i);
    dayStats[formatDateKey(date)] = {
      label: shortDate(date),
      revenue: 0,
      orders: 0,
    };
  }

  orders.forEach((order) => {
    if (isCancelledOrder(order)) return;

    const dateKey = formatDateKey(getOrderDate(order));
    if (dayStats[dateKey]) {
      if (isRevenueOrder(order)) {
        dayStats[dateKey].revenue += getOrderTotal(order);
      }
      dayStats[dateKey].orders += 1;
    }
  });

  return Object.values(dayStats);
}

export function generateHourlyDemand(orders: Order[]): ChartHourlyDemand[] {
  const hourStats: Record<string, number> = {};

  // Initialize all 24 hours to handle zero-value intervals
  for (let h = 0; h < 24; h++) {
    const hrStr = `${h.toString().padStart(2, "0")}:00`;
    hourStats[hrStr] = 0;
  }

  orders.forEach((order) => {
    if (isCancelledOrder(order)) return;
    const date = getOrderDate(order);
    const hrStr = `${date.getHours().toString().padStart(2, "0")}:00`;
    hourStats[hrStr] += 1;
  });

  return Object.entries(hourStats)
    .map(([hour, count]) => ({
      hour,
      orders: count,
    }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}
