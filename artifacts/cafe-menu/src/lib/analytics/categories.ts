import { Order, Category, MenuItem, CategoryStat } from "./types";
import { isCancelledOrder, isRevenueOrder } from "./revenue";

export function calculateCategoryStats(
  orders: Order[],
  categories: Category[],
  menuItems: MenuItem[]
): CategoryStat[] {
  const categoryMap: Record<number, string> = {};
  categories.forEach((cat) => {
    categoryMap[cat.id] = cat.name;
  });

  const itemCategoryMap: Record<string, string> = {};
  menuItems.forEach((item) => {
    const catName = categoryMap[item.category_id] || "Other";
    itemCategoryMap[item.name.trim().toLowerCase()] = catName;
  });

  const categoryStats: Record<
    string,
    { name: string; revenue: number; ordersCount: number }
  > = {};

  categories.forEach((cat) => {
    categoryStats[cat.name] = { name: cat.name, revenue: 0, ordersCount: 0 };
  });
  categoryStats["Other"] = { name: "Other", revenue: 0, ordersCount: 0 };

  orders.forEach((order) => {
    if (isCancelledOrder(order)) return;

    const orderCategories = new Set<string>();
    const isPaid = isRevenueOrder(order);

    order.order_items?.forEach((item) => {
      const rawName = item.item_name || item.name || item.menu_items?.name || "";
      const name = rawName.trim().toLowerCase();
      if (!name) return;

      const catName = itemCategoryMap[name] || "Other";
      const qty = Number(item.quantity ?? 1);
      const price = Number(item.price ?? 0);

      if (isPaid) {
        categoryStats[catName].revenue += price * qty;
      }
      orderCategories.add(catName);
    });

    orderCategories.forEach((catName) => {
      categoryStats[catName].ordersCount += 1;
    });
  });

  const statsList = Object.values(categoryStats).filter(
    (c) => c.revenue > 0 || c.ordersCount > 0
  );

  const totalRevenue = statsList.reduce((sum, c) => sum + c.revenue, 0);

  let tempSum = 0;
  const result: CategoryStat[] = statsList.map((c) => {
    const percent = totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0;
    const roundedPercent = Math.round(percent * 10) / 10;
    tempSum += roundedPercent;
    return {
      ...c,
      percent: roundedPercent,
    };
  });

  if (result.length > 0 && totalRevenue > 0) {
    const difference = 100 - tempSum;
    if (Math.abs(difference) > 0.001) {
      let maxIdx = 0;
      for (let i = 1; i < result.length; i++) {
        if (result[i].revenue > result[maxIdx].revenue) {
          maxIdx = i;
        }
      }
      result[maxIdx].percent = Number(
        (result[maxIdx].percent + difference).toFixed(1)
      );
    }
  }

  return result.sort((a, b) => b.revenue - a.revenue);
}
