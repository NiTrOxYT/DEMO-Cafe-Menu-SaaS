import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getListOrdersQueryKey } from "@/lib/api";
import {
  Loader2,
  Clock,
  ChefHat,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type OrderItem = { id: number; name: string; price: number; quantity: number };
type Order = {
  recentlyUpdated?: boolean;
  id: number;
  is_updated?: boolean;
  latest_added_items?: string[];
  table_id?: number | null;
  tableNumber?: string | null;
  customerName?: string | null;
  order_items?: any[];
  items: OrderItem[];
  total: number;
  status: string;
  whatsappSent: boolean;
  notes?: string | null;
  created_at: string;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pending",
    color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    icon: <Clock size={12} />,
  },
  preparing: {
    label: "Preparing",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    icon: <ChefHat size={12} />,
  },
  ready: {
    label: "Ready",
    color: "bg-green-500/15 text-green-400 border-green-500/30",
    icon: <CheckCircle size={12} />,
  },
  completed: {
    label: "Completed",
    color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    icon: <CheckCircle size={12} />,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: <XCircle size={12} />,
  },
};

const STATUS_FLOW: Record<string, string> = {
  pending: "preparing",
  preparing: "ready",
  ready: "completed",
};

function formatINR(n: number) {
  return `₹${Math.round(n)}`;
}
function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (opts: any) => opts;
  const [orders, setOrders] = useState<Order[]>([]);
  const [newItems, setNewItems] = useState<Record<number, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("admin-orders")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        (payload: any) => {
          fetchOrders();

          if (payload.eventType === "UPDATE") {
            fetchOrders();

            // setTimeout(() => {
            //   setUpdatedOrders((prev) =>
            //     prev.filter((id) => id !== payload.new.id),
            //   );
            // }, 10000);
          }
        },
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          fetchOrders();
        },
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchOrders() {
    console.log("Refresh clicked");

    const { data, error } = await supabase
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

    console.log("Data:", data);
    console.log("Error:", error);

    if (!error && data) {
      setOrders(data as Order[]);
    }

    setIsLoading(false);
  }

  async function updateOrderStatus(id: number, status: string) {
    await supabase
      .from("orders")
      .update({
        status,

        is_active: status === "completed" ? false : true,

        is_paid: status === "completed" ? true : false,

        ...(status === "preparing"
          ? {
              is_updated: false,
              latest_added_items: [],
            }
          : {}),
      })
      .eq("id", id);

    fetchOrders();
  }

  async function deleteOrder(id: number) {
    await supabase.from("orders").delete().eq("id", id);

    fetchOrders();
  }
  // const updateStatus = useUpdateOrderStatus();
  // const deleteOrder = useDeleteOrder();

  const filtered =
    filter === "all"
      ? orders
      : (orders as Order[]).filter((o) => o.status === filter);
  const sorted = [...(filtered as Order[])].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  //const handleNextStatus = (order: Order) => {
  // const next = STATUS_FLOW[order.status];
  // if (!next) return;
  // updateStatus.mutate(
  //  { id: order.id, data: { status: next as any } },
  //  {
  //  onSuccess: () => {
  //   queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
  //    toast({ description: `Order #${order.id} marked as ${next}` });
  //    },
  //   },
  //  );
  //};

  // const handleDelete = (id: number) => {
  //   if (!window.confirm("Delete this order?")) return;
  //   deleteOrder.mutate(
  //     { id },
  //     {
  //       onSuccess: () => {
  //         queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
  //         toast({ description: "Order deleted" });
  //       },
  //     },
  //   );
  // };

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  const counts: Record<string, number> = { all: (orders as Order[]).length };
  (orders as Order[]).forEach((o) => {
    counts[o.status] = (counts[o.status] ?? 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif font-bold text-foreground">
          Orders
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchOrders}
          className="
            active:scale-95
            transition-all
            duration-150
            hover:shadow-md
            hover:border-primary/50
            hover:bg-primary/5
          "
        >
          <RefreshCw size={14} className="mr-2" />
          Refresh
        </Button>
      </div>

      {/* Dashboard Stats */}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total Orders</p>
          <p className="text-2xl font-bold">{orders.length}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Revenue</p>
          <p className="text-2xl font-bold">
            ₹{orders.reduce((sum, o) => sum + Number(o.total || 0), 0)}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-yellow-500">
            {orders.filter((o) => o.status === "pending").length}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold text-green-500">
            {orders.filter((o) => o.status === "completed").length}
          </p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {["all", "pending", "preparing", "ready", "completed", "cancelled"].map(
          (s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                filter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:border-primary/40"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {counts[s] ? (
                <span className="ml-1 opacity-70">({counts[s]})</span>
              ) : null}
            </button>
          ),
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-3">📋</p>
          <p>No orders yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((order) => {
            const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
            const next = STATUS_FLOW[order.status];
            const latestAddedItems = order.latest_added_items ?? [];
            return (
              <div
                key={order.id}
                className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3"
              >
                {/* Order header */}
                <div className="flex items-center justify-between">
                  {order.is_updated && (
                    <div className="mb-2">
                      <span className="bg-yellow-500 text-black px-2 py-1 rounded-md text-xs font-bold animate-pulse">
                        UPDATED
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-bold text-foreground">
                      Table {order.table_id || 1}
                    </span>
                    {order.tableNumber && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        Table {order.tableNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.color}`}
                    >
                      {cfg.icon} {cfg.label}
                    </span>
                    <button
                      onClick={() => deleteOrder(order.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {latestAddedItems.length > 0 && (
                  <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-3 mb-3">
                    <div className="font-bold text-yellow-700 mb-2 text-sm">
                      ⚡ NEW ITEMS ADDED
                    </div>

                    {latestAddedItems.map((item: string, index: number) => (
                      <div
                        key={index}
                        className="text-sm font-medium text-black"
                      >
                        + {item}
                      </div>
                    ))}
                  </div>
                )}

                {/* Items */}
                <div className="space-y-2 border-t border-border pt-3">
                  {order.order_items?.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div>
                        <span className="text-foreground font-medium">
                          {item.quantity}x
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {item.item_name ||
                            item.menu_items?.name ||
                            "Unknown Item"}
                        </span>
                      </div>

                      <span className="text-foreground font-medium">
                        ₹{item.price * item.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                {order.notes && (
                  <p className="text-xs text-muted-foreground italic border-t border-border pt-2">
                    Note: {order.notes}
                  </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <div>
                    <p className="text-base font-bold text-foreground">
                      {formatINR(order.total)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatTime(order.created_at)}
                    </p>
                  </div>
                  {next && (
                    <Button
                      size="sm"
                      onClick={() => updateOrderStatus(order.id, next)}
                    >
                      Mark {next}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
