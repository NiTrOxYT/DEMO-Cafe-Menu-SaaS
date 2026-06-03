import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AnalyticsPage() {
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("analytics")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => loadData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadData() {
    const { data } = await supabase.from("orders").select(`
        *,
        order_items(*)
      `);

    setOrders(data || []);
  }

  const revenue = orders.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0,
  );

  const pending = orders.filter((o) => o.status === "pending").length;

  const completed = orders.filter((o) => o.status === "completed").length;

  const avgOrder = orders.length > 0 ? revenue / orders.length : 0;

  const itemSales: Record<string, number> = {};

  orders.forEach((order) => {
    order.order_items?.forEach((item: any) => {
      itemSales[item.item_name || "Unknown Item"] =
        (itemSales[item.item_name || "Unknown Item"] || 0) + item.quantity;
    });
  });

  const topItems = Object.entries(itemSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const itemRevenue: Record<string, number> = {};

  orders.forEach((order) => {
    order.order_items?.forEach((item: any) => {
      itemRevenue[item.item_name || "Unknown Item"] =
        (itemRevenue[item.item_name || "Unknown Item"] || 0) +
        item.price * item.quantity;
    });
  });

  const revenueItems = Object.entries(itemRevenue).sort(
    (a, b) => Number(b[1]) - Number(a[1]),
  );

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Analytics</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="border rounded-xl p-4">
          <p className="text-sm text-gray-500">Revenue</p>
          <h2 className="text-2xl font-bold">₹{revenue}</h2>
        </div>
        <div className="border rounded-xl p-4">
          <p className="text-sm text-gray-500">Avg Order</p>
          <h2 className="text-2xl font-bold">₹{Math.round(avgOrder)}</h2>
        </div>

        <div className="border rounded-xl p-4">
          <p className="text-sm text-gray-500">Orders</p>
          <h2 className="text-2xl font-bold">{orders.length}</h2>
        </div>

        <div className="border rounded-xl p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <h2 className="text-2xl font-bold">{pending}</h2>
        </div>

        <div className="border rounded-xl p-4">
          <p className="text-sm text-gray-500">Completed</p>
          <h2 className="text-2xl font-bold">{completed}</h2>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">Highly Re-Ordered Items</h2>

      <div className="space-y-2">
        {topItems.map(([name, qty]) => (
          <div
            key={name}
            className="flex justify-between border rounded-lg p-3"
          >
            <span>{name}</span>
            <span className="font-bold">{qty}</span>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold mt-8 mb-4">Revenue By Item</h2>

      <div className="space-y-2">
        {revenueItems.map(([name, revenue]) => (
          <div
            key={name}
            className="flex justify-between border rounded-lg p-3"
          >
            <span>{name}</span>

            <span className="font-bold">₹{Number(revenue)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
