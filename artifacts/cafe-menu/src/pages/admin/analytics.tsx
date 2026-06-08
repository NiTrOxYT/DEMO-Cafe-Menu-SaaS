import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowUpRight,
  BadgeIndianRupee,
  Clock3,
  Crown,
  Loader2,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Table2,
  Timer,
  Utensils,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type OrderItem = {
  id?: number;
  item_name?: string | null;
  name?: string | null;
  price?: number | string | null;
  quantity?: number | string | null;
  menu_items?: { name?: string | null } | null;
};

type Order = {
  id: number;
  status?: string | null;
  total?: number | string | null;
  total_amount?: number | string | null;
  totalAmount?: number | string | null;
  table_id?: number | string | null;
  tableNumber?: string | null;
  customerName?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  order_items?: OrderItem[] | null;
};

type RangeKey = "7d" | "30d" | "all";

const STATUS_COLORS: Record<string, string> = {
  pending: "#d97706",
  preparing: "#2563eb",
  ready: "#059669",
  completed: "#18181b",
  cancelled: "#dc2626",
};

const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "7D",
  "30d": "30D",
  all: "All",
};

const ANALYTICS_READ_TIMEOUT_MS = 6000;

function toNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getOrderTotal(order: Order) {
  return toNumber(order.total ?? order.total_amount ?? order.totalAmount);
}

function getOrderDate(order: Order) {
  const raw = order.created_at ?? order.createdAt;
  const date = raw ? new Date(raw) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getItemName(item: OrderItem) {
  return (
    item.item_name ||
    item.name ||
    item.menu_items?.name ||
    "Unknown item"
  ).trim();
}

function getTableLabel(order: Order) {
  return String(order.table_id ?? order.tableNumber ?? "Walk-in");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shortDate(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-border bg-card/70 rounded-lg px-6 py-14 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-secondary" />
      <h3 className="mt-3 text-lg font-serif font-semibold">
        No orders in this window
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Analytics will populate automatically as orders come in.
      </p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("7d");

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
    setIsLoading(true);
    try {
      const query = supabase
        .from("orders")
        .select(
          `
        *,
        order_items (
          *,
          menu_items (
            name
          )
        )
      `,
        )
        .order("created_at", { ascending: false });
      const timeout = new Promise<never>((_, reject) => {
        window.setTimeout(
          () => reject(new Error("Analytics read timed out")),
          ANALYTICS_READ_TIMEOUT_MS,
        );
      });
      const { data, error } = await Promise.race([query, timeout]);

      if (!error) {
        setOrders((data || []) as Order[]);
      }
    } finally {
      setIsLoading(false);
    }
  }

  const analytics = useMemo(() => {
    const now = new Date();
    const rangeStart =
      range === "all"
        ? null
        : new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - (range === "7d" ? 6 : 29),
          );

    const scopedOrders = orders.filter((order) => {
      if (!rangeStart) return true;
      return getOrderDate(order) >= rangeStart;
    });

    const completedOrders = scopedOrders.filter(
      (order) => order.status === "completed",
    );
    const activeOrders = scopedOrders.filter(
      (order) => !["completed", "cancelled"].includes(order.status || ""),
    );
    const revenue = scopedOrders.reduce(
      (sum, order) => sum + getOrderTotal(order),
      0,
    );
    const todayRevenue = scopedOrders
      .filter((order) => isSameDay(getOrderDate(order), now))
      .reduce((sum, order) => sum + getOrderTotal(order), 0);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayRevenue = scopedOrders
      .filter((order) => isSameDay(getOrderDate(order), yesterday))
      .reduce((sum, order) => sum + getOrderTotal(order), 0);

    const itemStats: Record<
      string,
      { name: string; quantity: number; revenue: number; orders: number }
    > = {};
    const tableStats: Record<
      string,
      { table: string; orders: number; revenue: number }
    > = {};
    const statusStats: Record<string, number> = {};
    const hourStats: Record<string, { hour: string; orders: number }> = {};
    const dayStats: Record<
      string,
      { label: string; revenue: number; orders: number }
    > = {};

    const daysToShow = range === "all" ? 14 : range === "7d" ? 7 : 30;
    for (let i = daysToShow - 1; i >= 0; i -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      dayStats[formatDateKey(date)] = {
        label: shortDate(date),
        revenue: 0,
        orders: 0,
      };
    }

    scopedOrders.forEach((order) => {
      const status = order.status || "unknown";
      statusStats[status] = (statusStats[status] || 0) + 1;

      const orderDate = getOrderDate(order);
      const dayKey = formatDateKey(orderDate);
      if (dayStats[dayKey]) {
        dayStats[dayKey].revenue += getOrderTotal(order);
        dayStats[dayKey].orders += 1;
      }

      const hour = `${orderDate.getHours().toString().padStart(2, "0")}:00`;
      hourStats[hour] = hourStats[hour] || { hour, orders: 0 };
      hourStats[hour].orders += 1;

      const table = getTableLabel(order);
      tableStats[table] = tableStats[table] || { table, orders: 0, revenue: 0 };
      tableStats[table].orders += 1;
      tableStats[table].revenue += getOrderTotal(order);

      const orderItemNames = new Set<string>();
      order.order_items?.forEach((item) => {
        const name = getItemName(item);
        const quantity = toNumber(item.quantity || 1);
        const lineRevenue = toNumber(item.price) * quantity;

        itemStats[name] = itemStats[name] || {
          name,
          quantity: 0,
          revenue: 0,
          orders: 0,
        };
        itemStats[name].quantity += quantity;
        itemStats[name].revenue += lineRevenue;
        orderItemNames.add(name);
      });

      orderItemNames.forEach((name) => {
        itemStats[name].orders += 1;
      });
    });

    const itemCount = Object.values(itemStats).reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const revenueItems = Object.values(itemStats).sort(
      (a, b) => b.revenue - a.revenue,
    );
    const quantityItems = Object.values(itemStats).sort(
      (a, b) => b.quantity - a.quantity,
    );
    const topTables = Object.values(tableStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    const peakHour =
      Object.values(hourStats).sort((a, b) => b.orders - a.orders)[0]?.hour ||
      "No peak";

    const dayTrend = Object.values(dayStats);
    const statusMix = Object.entries(statusStats).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      key: name,
      value,
    }));
    const hourlyDemand = Object.values(hourStats)
      .sort((a, b) => a.hour.localeCompare(b.hour))
      .slice(-12);

    return {
      scopedOrders,
      activeOrders,
      completedOrders,
      revenue,
      todayRevenue,
      yesterdayRevenue,
      avgOrder: scopedOrders.length ? revenue / scopedOrders.length : 0,
      avgItems: scopedOrders.length ? itemCount / scopedOrders.length : 0,
      completionRate: scopedOrders.length
        ? (completedOrders.length / scopedOrders.length) * 100
        : 0,
      topItem: revenueItems[0],
      topTables,
      peakHour,
      dayTrend,
      statusMix,
      hourlyDemand,
      revenueItems: revenueItems.slice(0, 8),
      quantityItems: quantityItems.slice(0, 8),
      highValueOrders: [...scopedOrders]
        .sort((a, b) => getOrderTotal(b) - getOrderTotal(a))
        .slice(0, 5),
    };
  }, [orders, range]);

  const revenueDelta =
    analytics.yesterdayRevenue > 0
      ? ((analytics.todayRevenue - analytics.yesterdayRevenue) /
          analytics.yesterdayRevenue) *
        100
      : analytics.todayRevenue > 0
        ? 100
        : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
            Live performance room
          </p>
          <h2 className="mt-1 text-3xl font-serif font-bold text-foreground">
            Analytics
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Revenue, demand, table velocity, and menu performance from live
            order data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-card p-1">
            {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={`h-8 min-w-12 rounded-md px-3 text-xs font-bold transition-colors ${
                  range === key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {RANGE_LABELS[key]}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {analytics.scopedOrders.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              icon={<BadgeIndianRupee className="h-5 w-5" />}
              label="Gross revenue"
              value={formatCurrency(analytics.revenue)}
              detail={`${formatCurrency(analytics.todayRevenue)} today`}
            />
            <MetricTile
              icon={<ShoppingBag className="h-5 w-5" />}
              label="Orders"
              value={analytics.scopedOrders.length.toString()}
              detail={`${analytics.activeOrders.length} still active`}
            />
            <MetricTile
              icon={<ArrowUpRight className="h-5 w-5" />}
              label="Average order"
              value={formatCurrency(analytics.avgOrder)}
              detail={`${analytics.avgItems.toFixed(1)} items per order`}
            />
            <MetricTile
              icon={<Activity className="h-5 w-5" />}
              label="Completion rate"
              value={`${Math.round(analytics.completionRate)}%`}
              detail={`${analytics.completedOrders.length} completed tickets`}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-xl font-semibold">
                    Revenue trend
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Daily sales and order count for the selected window.
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    revenueDelta >= 0
                      ? "bg-emerald-500/15 text-emerald-700"
                      : "bg-red-500/15 text-red-700"
                  }`}
                >
                  {revenueDelta >= 0 ? "+" : ""}
                  {Math.round(revenueDelta)}% today
                </span>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.dayTrend}>
                    <defs>
                      <linearGradient
                        id="revenueFill"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop offset="5%" stopColor="#18181b" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#18181b" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#d6d3d1" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#57534e", fontSize: 12 }}
                    />
                    <YAxis
                      tickFormatter={(value) => `₹${formatCompact(Number(value))}`}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#57534e", fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value, name) =>
                        name === "revenue"
                          ? [formatCurrency(Number(value)), "Revenue"]
                          : [value, "Orders"]
                      }
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #d6d3d1",
                        boxShadow: "0 18px 40px rgba(0,0,0,.12)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#18181b"
                      strokeWidth={3}
                      fill="url(#revenueFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <InsightTile
                icon={<Crown className="h-5 w-5" />}
                label="Hero item"
                value={analytics.topItem?.name || "No item yet"}
                detail={
                  analytics.topItem
                    ? `${formatCurrency(analytics.topItem.revenue)} from ${
                        analytics.topItem.quantity
                      } sold`
                    : "Waiting for item sales"
                }
              />
              <InsightTile
                icon={<Clock3 className="h-5 w-5" />}
                label="Peak demand"
                value={analytics.peakHour}
                detail="Busiest order hour in this range"
              />
              <InsightTile
                icon={<Table2 className="h-5 w-5" />}
                label="Best table"
                value={
                  analytics.topTables[0]
                    ? `Table ${analytics.topTables[0].table}`
                    : "No table yet"
                }
                detail={
                  analytics.topTables[0]
                    ? `${formatCurrency(analytics.topTables[0].revenue)} across ${
                        analytics.topTables[0].orders
                      } orders`
                    : "Waiting for table activity"
                }
              />
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Panel title="Status mix" subtitle="Current order pipeline.">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.statusMix}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={92}
                      paddingAngle={4}
                    >
                      {analytics.statusMix.map((entry) => (
                        <Cell
                          key={entry.key}
                          fill={STATUS_COLORS[entry.key] || "#78716c"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [value, "Orders"]}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #d6d3d1",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {analytics.statusMix.map((status) => (
                  <div
                    key={status.key}
                    className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-xs"
                  >
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            STATUS_COLORS[status.key] || "#78716c",
                        }}
                      />
                      {status.name}
                    </span>
                    <span className="font-bold">{status.value}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Demand by hour" subtitle="Recent service rhythm.">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.hourlyDemand}>
                    <CartesianGrid stroke="#d6d3d1" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="hour"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#57534e", fontSize: 12 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#57534e", fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value) => [value, "Orders"]}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #d6d3d1",
                      }}
                    />
                    <Bar dataKey="orders" fill="#b45309" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Top tables" subtitle="Revenue concentration.">
              <div className="space-y-3">
                {analytics.topTables.map((table, index) => {
                  const max = analytics.topTables[0]?.revenue || 1;
                  return (
                    <RankRow
                      key={table.table}
                      rank={index + 1}
                      name={`Table ${table.table}`}
                      value={formatCurrency(table.revenue)}
                      detail={`${table.orders} orders`}
                      percent={(table.revenue / max) * 100}
                    />
                  );
                })}
              </div>
            </Panel>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Menu winners by revenue"
              subtitle="Items generating the most sales."
            >
              <div className="space-y-3">
                {analytics.revenueItems.map((item, index) => {
                  const max = analytics.revenueItems[0]?.revenue || 1;
                  return (
                    <RankRow
                      key={item.name}
                      rank={index + 1}
                      name={item.name}
                      value={formatCurrency(item.revenue)}
                      detail={`${item.quantity} sold in ${item.orders} orders`}
                      percent={(item.revenue / max) * 100}
                    />
                  );
                })}
              </div>
            </Panel>

            <Panel
              title="Most reordered items"
              subtitle="Quantity leaders that customers keep choosing."
            >
              <div className="space-y-3">
                {analytics.quantityItems.map((item, index) => {
                  const max = analytics.quantityItems[0]?.quantity || 1;
                  return (
                    <RankRow
                      key={item.name}
                      rank={index + 1}
                      name={item.name}
                      value={`${item.quantity} sold`}
                      detail={formatCurrency(item.revenue)}
                      percent={(item.quantity / max) * 100}
                    />
                  );
                })}
              </div>
            </Panel>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl font-semibold">
                  High-value tickets
                </h3>
                <p className="text-xs text-muted-foreground">
                  Biggest orders in the selected range.
                </p>
              </div>
              <Timer className="h-5 w-5 text-secondary" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="py-3 font-semibold">Order</th>
                    <th className="py-3 font-semibold">Table</th>
                    <th className="py-3 font-semibold">Time</th>
                    <th className="py-3 font-semibold">Status</th>
                    <th className="py-3 text-right font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.highValueOrders.map((order) => (
                    <tr key={order.id} className="border-b border-border/60">
                      <td className="py-3 font-bold">#{order.id}</td>
                      <td className="py-3 text-muted-foreground">
                        Table {getTableLabel(order)}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {getOrderDate(order).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3">
                        <span className="rounded-full bg-background px-2.5 py-1 text-xs font-bold capitalize">
                          {order.status || "unknown"}
                        </span>
                      </td>
                      <td className="py-3 text-right font-bold">
                        {formatCurrency(getOrderTotal(order))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function MetricTile({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-md bg-background p-2 text-secondary">{icon}</div>
        <Utensils className="h-4 w-4 text-muted-foreground/50" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function InsightTile({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-primary text-primary-foreground p-2">
          {icon}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 text-lg font-bold">{value}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="font-serif text-xl font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function RankRow({
  rank,
  name,
  value,
  detail,
  percent,
}: {
  rank: number;
  name: string;
  value: string;
  detail: string;
  percent: number;
}) {
  return (
    <div className="rounded-md bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              {rank}
            </span>
            <p className="truncate font-semibold">{name}</p>
          </div>
          <p className="mt-1 pl-8 text-xs text-muted-foreground">{detail}</p>
        </div>
        <p className="shrink-0 text-sm font-bold">{value}</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-secondary"
          style={{ width: `${Math.max(8, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}
