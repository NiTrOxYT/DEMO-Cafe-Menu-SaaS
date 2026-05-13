import { useState } from "react";
import { useListOrders, useUpdateOrderStatus, useDeleteOrder } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListOrdersQueryKey } from "@workspace/api-client-react";
import { Loader2, Clock, ChefHat, CheckCircle, XCircle, Trash2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type OrderItem = { id: number; name: string; price: number; quantity: number };
type Order = {
  id: number;
  tableNumber?: string | null;
  customerName?: string | null;
  items: OrderItem[];
  totalAmount: number;
  status: string;
  whatsappSent: boolean;
  notes?: string | null;
  createdAt: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", icon: <Clock size={12} /> },
  preparing: { label: "Preparing", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: <ChefHat size={12} /> },
  ready: { label: "Ready", color: "bg-green-500/15 text-green-400 border-green-500/30", icon: <CheckCircle size={12} /> },
  completed: { label: "Completed", color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30", icon: <CheckCircle size={12} /> },
  cancelled: { label: "Cancelled", color: "bg-red-500/15 text-red-400 border-red-500/30", icon: <XCircle size={12} /> },
};

const STATUS_FLOW: Record<string, string> = {
  pending: "preparing",
  preparing: "ready",
  ready: "completed",
};

function formatINR(n: number) { return `₹${Math.round(n)}`; }
function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");

  const { data: orders = [], isLoading, refetch } = useListOrders({ query: { refetchInterval: 15000 } });
  const updateStatus = useUpdateOrderStatus();
  const deleteOrder = useDeleteOrder();

  const filtered = filter === "all" ? orders : (orders as Order[]).filter((o) => o.status === filter);
  const sorted = [...(filtered as Order[])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleNextStatus = (order: Order) => {
    const next = STATUS_FLOW[order.status];
    if (!next) return;
    updateStatus.mutate({ id: order.id, data: { status: next as any } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        toast({ description: `Order #${order.id} marked as ${next}` });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("Delete this order?")) return;
    deleteOrder.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        toast({ description: "Order deleted" });
      }
    });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const counts: Record<string, number> = { all: (orders as Order[]).length };
  (orders as Order[]).forEach((o) => { counts[o.status] = (counts[o.status] ?? 0) + 1; });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif font-bold text-foreground">Orders</h2>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw size={14} className="mr-2" /> Refresh
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {["all", "pending", "preparing", "ready", "completed", "cancelled"].map((s) => (
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
            {counts[s] ? <span className="ml-1 opacity-70">({counts[s]})</span> : null}
          </button>
        ))}
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
            return (
              <div key={order.id} className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3">
                {/* Order header */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-foreground">Order #{order.id}</span>
                    {order.tableNumber && (
                      <span className="ml-2 text-xs text-muted-foreground">Table {order.tableNumber}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.color}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                    <button
                      onClick={() => handleDelete(order.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-1 border-t border-border pt-2">
                  {(order.items as OrderItem[]).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.name} <span className="text-foreground font-medium">×{item.quantity}</span></span>
                      <span className="text-foreground font-medium">{formatINR(item.price * item.quantity)}</span>
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
                    <p className="text-base font-bold text-foreground">{formatINR(order.totalAmount)}</p>
                    <p className="text-[11px] text-muted-foreground">{timeAgo(order.createdAt)}</p>
                  </div>
                  {next && (
                    <Button
                      size="sm"
                      onClick={() => handleNextStatus(order)}
                      disabled={updateStatus.isPending}
                    >
                      {updateStatus.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
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
