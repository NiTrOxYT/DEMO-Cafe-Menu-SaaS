import { Order, RangeKey } from "./types";

export function getOrderDate(order: Order): Date {
  const raw = order.created_at ?? order.createdAt;
  const date = raw ? new Date(raw) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function formatDateKey(date: Date): string {
  // Use local timezone formatting (YYYY-MM-DD)
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function shortDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getComparisonWindows(range: RangeKey): {
  currentStart: Date;
  currentEnd: Date;
  prevStart: Date;
  prevEnd: Date;
  hasComparison: boolean;
} {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

  let currentStart = new Date();
  let currentEnd = new Date();
  let prevStart = new Date();
  let prevEnd = new Date();
  let hasComparison = true;

  if (range === "today") {
    currentStart = startOfToday;
    currentEnd = now;
    prevStart = startOfYesterday;
    prevEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, now.getHours(), now.getMinutes(), now.getSeconds());
  } else if (range === "yesterday") {
    currentStart = startOfYesterday;
    currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, -1);
    prevStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
    prevEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, -1);
  } else if (range === "7d") {
    currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    currentEnd = now;
    prevStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
    prevEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 23, 59, 59, 999);
  } else if (range === "30d") {
    currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    currentEnd = now;
    prevStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 59);
    prevEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 23, 59, 59, 999);
  } else if (range === "thisMonth") {
    currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    currentEnd = now;
    prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, now.getHours(), now.getMinutes(), now.getSeconds());
  } else if (range === "prevMonth") {
    currentStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    currentEnd = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, -1);
    prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, -1);
  } else {
    hasComparison = false;
  }

  return { currentStart, currentEnd, prevStart, prevEnd, hasComparison };
}
