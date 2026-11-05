import { useEffect, useState } from "react";
import { getAdminOrders, updateOrderStatus as apiUpdateOrderStatus, deleteOrder as apiDeleteOrder, Order } from "@/lib/api";
import { joinAdminRoom, onOrderCreated, onOrderUpdated, onOrderStatusChanged, onOrderDeleted } from "@/lib/socket";
import {
  Loader2,
  Clock,
  ChefHat,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pending",
    color: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    icon: <Clock size={12} />,
  },
  preparing: {
    label: "Preparing",
    color: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    icon: <ChefHat size={12} />,
  },
  ready: {
    label: "Ready",
    color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    icon: <CheckCircle size={12} />,
  },
  completed: {
    label: "Completed",
    color: "bg-[#FAF3E6] text-[#8E6314] border-[#ECD7A9]",
    icon: <CheckCircle size={12} />,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-rose-500/10 text-rose-700 border-rose-500/30",
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

function playNotificationSound() {
  try {
    const audio = new Audio("/sound/order-notification.mp3");
    audio.play().catch(() => {});
  } catch {}
}

export default function OrdersPage() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchOrders() {
    try {
      const data = await getAdminOrders();
      setOrders(data);
    } catch (err: any) {
      console.error("Failed to load orders:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();

    // Join admin realtime updates room
    joinAdminRoom();

    // Listen to Socket.IO events
    const unsubCreated = onOrderCreated((newOrder) => {
      playNotificationSound();
      toast({
        title: "⚡ New Order Received!",
        description: `Table ${newOrder.table_number || newOrder.table_id || 1} placed Order #${newOrder.id}`,
      });
      fetchOrders();
    });

    const unsubUpdated = onOrderUpdated((updatedOrder) => {
      playNotificationSound();
      toast({
        title: "⚡ Order Updated!",
        description: `Items added to Table ${updatedOrder.table_number || updatedOrder.table_id || 1} (Order #${updatedOrder.id})`,
      });
      fetchOrders();
    });

    const unsubStatus = onOrderStatusChanged(() => {
      fetchOrders();
    });

    const unsubDeleted = onOrderDeleted(() => {
      fetchOrders();
    });

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubStatus();
      unsubDeleted();
    };
  }, []);

  async function updateOrderStatus(id: number, status: string) {
    try {
      await apiUpdateOrderStatus(id, status);
      fetchOrders();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: err.message,
      });
    }
  }

  async function deleteOrder(id: number) {
    if (!window.confirm("Are you sure you want to delete this order?")) return;
    try {
      await apiDeleteOrder(id);
      fetchOrders();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: err.message,
      });
    }
  }

  const filtered =
    filter === "all"
      ? orders
      : orders.filter((o) => o.status === filter);
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const counts: Record<string, number> = { all: orders.length };
  orders.forEach((o) => {
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
          className="active:scale-95 transition-all duration-150 hover:shadow-md hover:border-primary/50 hover:bg-primary/5"
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all border ${
                filter === s
                  ? "bg-[#FAF3E6] text-[#8E6314] border-[#ECD7A9] shadow-2xs font-bold"
                  : "bg-card text-muted-foreground border-border/80 hover:border-[#ECD7A9] hover:text-foreground"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {counts[s] ? (
                <span className="ml-1 opacity-80">({counts[s]})</span>
              ) : null}
            </button>
          )
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border border-dashed border-border/80 bg-card/60 rounded-xl">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium text-sm">No orders in this view</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((order) => {
            const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
            const next = STATUS_FLOW[order.status];
            const latestAddedItems = Array.isArray(order.latest_added_items) ? order.latest_added_items : [];

            return (
              <div
                key={order.id}
                className="bg-card rounded-xl border border-border/80 p-5 flex flex-col gap-3.5 shadow-xs hover:border-[#ECD7A9] transition-all relative overflow-hidden"
              >
                {/* Order header */}
                <div className="flex items-center justify-between">
                  {order.is_updated && (
                    <div className="mb-1">
                      <span className="bg-amber-500/15 border border-amber-500/30 text-amber-900 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase animate-pulse">
                        UPDATED
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-base font-bold font-serif text-foreground">
                      Table {order.table_number || order.table_id || 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.color}`}
                    >
                      {cfg.icon} {cfg.label}
                    </span>
                    <button
                      onClick={() => deleteOrder(order.id)}
                      className="text-muted-foreground/60 hover:text-destructive transition-colors p-1 rounded-md hover:bg-destructive/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {latestAddedItems.length > 0 && (
                  <div className="bg-[#FAF3E6] border border-[#ECD7A9] rounded-lg p-3">
                    <div className="font-bold text-[#8E6314] mb-1.5 text-xs flex items-center gap-1">
                      ⚡ NEW ITEMS ADDED
                    </div>
                    {latestAddedItems.map((item: string, index: number) => (
                      <div
                        key={index}
                        className="text-xs font-semibold text-[#1F1B18]"
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
                          {item.item_name || "Item"}
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

