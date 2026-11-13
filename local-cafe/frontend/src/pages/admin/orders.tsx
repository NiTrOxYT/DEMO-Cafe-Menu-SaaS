import { useEffect, useState, useMemo } from "react";
import {
  getAdminOrders,
  updateOrderStatus as apiUpdateOrderStatus,
  deleteOrder as apiDeleteOrder,
  getActiveSessions,
  payTableSession,
  closeTableSession,
  finishTableSession,
  ActiveTableSessionSummary,
  Order,
} from "@/lib/api";
import {
  joinAdminRoom,
  onOrderCreated,
  onOrderUpdated,
  onOrderStatusChanged,
  onOrderDeleted,
  onSessionCreated,
  onSessionUpdated,
  onSessionFinished,
} from "@/lib/socket";
import {
  Loader2,
  Clock,
  ChefHat,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
  Users,
  Check,
  AlertCircle,
  Receipt,
  Utensils,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pending",
    color: "bg-amber-500/10 text-amber-800 border-amber-500/30",
    icon: <Clock size={12} />,
  },
  accepted: {
    label: "Accepted",
    color: "bg-indigo-500/10 text-indigo-800 border-indigo-500/30",
    icon: <Check size={12} />,
  },
  preparing: {
    label: "Preparing",
    color: "bg-blue-500/10 text-blue-800 border-blue-500/30",
    icon: <ChefHat size={12} />,
  },
  ready: {
    label: "Ready",
    color: "bg-emerald-500/10 text-emerald-800 border-emerald-500/30",
    icon: <CheckCircle size={12} />,
  },
  served: {
    label: "Served",
    color: "bg-teal-500/10 text-teal-800 border-teal-500/30",
    icon: <Utensils size={12} />,
  },
  completed: {
    label: "Completed",
    color: "bg-[#FAF3E6] text-[#8E6314] border-[#ECD7A9]",
    icon: <CheckCircle size={12} />,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-rose-500/10 text-rose-800 border-rose-500/30",
    icon: <XCircle size={12} />,
  },
};

const NEXT_STATUS: Record<string, { next: string; label: string }> = {
  pending: { next: "accepted", label: "Accept Order" },
  accepted: { next: "preparing", label: "Start Preparing" },
  preparing: { next: "ready", label: "Mark Ready" },
  ready: { next: "served", label: "Mark Served" },
};

function formatINR(n: number) {
  return `₹${Math.round(n)}`;
}

function formatOrderDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function formatOrderTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function playNotificationSound() {
  try {
    const audio = new Audio("/sound/order-notification.mp3");
    audio.play().catch(() => {});
  } catch {}
}

interface SessionGroup {
  groupKey: string;
  tableNumber: string;
  sessionId?: number;
  session?: ActiveTableSessionSummary;
  isCurrentActive: boolean;
  statusLabel?: string;
  orders: Order[];
  visibleOrders?: Order[];
}

type OrderDateRange = "all" | "today" | "yesterday" | "7days" | "30days" | "custom";

function getIndiaDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveTableSessionSummary[]>([]);
  const [payingSessionId, setPayingSessionId] = useState<number | null>(null);
  const [closingSessionId, setClosingSessionId] = useState<number | null>(null);
  const [closeSessionModal, setCloseSessionModal] = useState<{
    isOpen: boolean;
    sessionId: number;
    tableNumber: string;
    unresolvedOrders: Order[];
  } | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("active");
  const [dateRange, setDateRange] = useState<OrderDateRange>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

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

  async function fetchSessions() {
    try {
      const sessions = await getActiveSessions();
      setActiveSessions(sessions);
    } catch (err) {
      console.error("Failed to load active sessions:", err);
    }
  }

  function initiateCloseSession(session: ActiveTableSessionSummary, tableOrders: Order[]) {
    const unresolved = tableOrders.filter((o) =>
      o.status !== "cancelled" && !["served", "completed"].includes(o.status)
    );
    setCloseSessionModal({
      isOpen: true,
      sessionId: session.id,
      tableNumber: String(session.tableNumber),
      unresolvedOrders: unresolved,
    });
  }

  async function handleConfirmCloseSession(sessionId: number, tableNumber: string) {
    try {
      setClosingSessionId(sessionId);
      await closeTableSession(sessionId);
      toast({
        title: `Table ${tableNumber} Session Closed (Unpaid)`,
        description: "Guest QR access ended without recording payment. Orders remain active for staff review.",
      });
      setCloseSessionModal(null);
      fetchSessions();
      fetchOrders();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to close table session",
        description: err.message,
      });
    } finally {
      setClosingSessionId(null);
    }
  }

  async function handlePaySession(sessionId: number, tableNumber: string, totalAmount: number) {
    if (
      !window.confirm(
        `Confirm payment of ${formatINR(totalAmount)} for Table ${tableNumber}?\n\nThis marks the session as Paid and closes it for guests. All order records and history are preserved in the system.`
      )
    ) {
      return;
    }

    try {
      setPayingSessionId(sessionId);
      await payTableSession(sessionId);
      toast({
        title: `Table ${tableNumber} Paid & Closed`,
        description: `Session closed successfully. Total ${formatINR(totalAmount)} marked as paid. All orders preserved in history.`,
      });
      fetchSessions();
      fetchOrders();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Payment action failed",
        description: err.message,
      });
    } finally {
      setPayingSessionId(null);
    }
  }

  useEffect(() => {
    fetchOrders();
    fetchSessions();

    // Join admin realtime updates room
    joinAdminRoom();

    // Listen to Socket.IO order events
    const unsubCreated = onOrderCreated((newOrder) => {
      playNotificationSound();
      toast({
        title: "⚡ New Order Received!",
        description: `Table ${newOrder.table_number || newOrder.table_id || 1} placed Order #${newOrder.id}`,
      });
      fetchOrders();
      fetchSessions();
    });

    const unsubUpdated = onOrderUpdated((updatedOrder) => {
      playNotificationSound();
      toast({
        title: "⚡ Order Updated!",
        description: `Items added to Table ${updatedOrder.table_number || updatedOrder.table_id || 1} (Order #${updatedOrder.id})`,
      });
      fetchOrders();
      fetchSessions();
    });

    const unsubStatus = onOrderStatusChanged(() => {
      fetchOrders();
      fetchSessions();
    });

    const unsubDeleted = onOrderDeleted(() => {
      fetchOrders();
      fetchSessions();
    });

    // Listen to Socket.IO table session events
    const unsubSessionCreated = onSessionCreated(() => {
      fetchSessions();
    });

    const unsubSessionUpdated = onSessionUpdated(() => {
      fetchSessions();
    });

    const unsubSessionFinished = onSessionFinished(() => {
      fetchSessions();
      fetchOrders();
    });

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubStatus();
      unsubDeleted();
      unsubSessionCreated();
      unsubSessionUpdated();
      unsubSessionFinished();
    };
  }, []);

  async function updateOrderStatus(id: number, status: string) {
    try {
      setUpdatingOrderId(id);
      await apiUpdateOrderStatus(id, status);
      fetchOrders();
      fetchSessions();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Status update failed",
        description: err.message,
      });
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function deleteOrder(id: number) {
    if (!window.confirm("Are you sure you want to delete this order?")) return;
    try {
      await apiDeleteOrder(id);
      fetchOrders();
      fetchSessions();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: err.message,
      });
    }
  }

  // Group orders strictly by session ID to prevent cross-session order leakage
  const tableGroups = useMemo<SessionGroup[]>(() => {
    const groups: SessionGroup[] = [];

    // 1. Active table sessions: exactly one group per active session
    activeSessions.forEach((s) => {
      // Filter orders strictly by this active session ID
      const sessionOrders = orders.filter((o) => o.session_id === s.id);
      groups.push({
        groupKey: `active_session_${s.id}`,
        tableNumber: String(s.tableNumber),
        sessionId: s.id,
        session: s,
        isCurrentActive: true,
        orders: sessionOrders,
      });
    });

    // 2. If viewing "all" or specific status tabs, also include past/closed sessions and historical orders
    if (filter !== "active") {
      const activeSessionIds = new Set(activeSessions.map((s) => s.id));
      const pastSessionsMap = new Map<number, Order[]>();
      const standaloneOrders: Order[] = [];

      orders.forEach((ord) => {
        if (ord.session_id && !activeSessionIds.has(ord.session_id)) {
          if (!pastSessionsMap.has(ord.session_id)) {
            pastSessionsMap.set(ord.session_id, []);
          }
          pastSessionsMap.get(ord.session_id)!.push(ord);
        } else if (!ord.session_id) {
          standaloneOrders.push(ord);
        }
      });

      // Add past sessions
      pastSessionsMap.forEach((pastOrders, sessId) => {
        const tNum = String(pastOrders[0]?.table_number || pastOrders[0]?.table_id || "1");
        const allPaid = pastOrders.every((o) => o.is_paid || o.status === "completed");
        groups.push({
          groupKey: `past_session_${sessId}`,
          tableNumber: tNum,
          sessionId: sessId,
          session: undefined,
          isCurrentActive: false,
          statusLabel: allPaid ? "Paid & Closed" : "Past Session",
          orders: pastOrders,
        });
      });

      // Add standalone / pre-session orders grouped by table if any
      if (standaloneOrders.length > 0) {
        const standaloneByTable = new Map<string, Order[]>();
        standaloneOrders.forEach((ord) => {
          const tNum = String(ord.table_number || ord.table_id || "1");
          if (!standaloneByTable.has(tNum)) standaloneByTable.set(tNum, []);
          standaloneByTable.get(tNum)!.push(ord);
        });
        standaloneByTable.forEach((ordList, tNum) => {
          groups.push({
            groupKey: `standalone_${tNum}`,
            tableNumber: tNum,
            sessionId: undefined,
            session: undefined,
            isCurrentActive: false,
            statusLabel: "History / Prior Orders",
            orders: ordList,
          });
        });
      }
    }

    // Sort: active sessions first (by tableNumber), then past sessions (by sessionId DESC)
    return groups.sort((a, b) => {
      if (a.isCurrentActive && !b.isCurrentActive) return -1;
      if (!a.isCurrentActive && b.isCurrentActive) return 1;
      if (a.isCurrentActive && b.isCurrentActive) {
        const numA = parseInt(a.tableNumber, 10);
        const numB = parseInt(b.tableNumber, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.tableNumber.localeCompare(b.tableNumber);
      }
      return (b.sessionId || 0) - (a.sessionId || 0);
    });
  }, [orders, activeSessions, filter]);

  const tableOptions = useMemo(() => {
    const tableNumbers = new Set(
      orders.map((order) => String(order.table_number || order.table_id || "1")),
    );
    return [...tableNumbers].sort((a, b) => {
      const numericDifference = Number(a) - Number(b);
      return Number.isNaN(numericDifference) || numericDifference === 0
        ? a.localeCompare(b)
        : numericDifference;
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const today = getIndiaDateKey(new Date());
    const activeSessionIds = new Set(activeSessions.map((session) => session.id));
    const normalizedSearch = searchQuery.trim().toLowerCase();

    let startDate = "";
    let endDate = "";
    if (dateRange === "today") {
      startDate = endDate = today;
    } else if (dateRange === "yesterday") {
      startDate = endDate = shiftDateKey(today, -1);
    } else if (dateRange === "7days") {
      startDate = shiftDateKey(today, -6);
      endDate = today;
    } else if (dateRange === "30days") {
      startDate = shiftDateKey(today, -29);
      endDate = today;
    } else if (dateRange === "custom") {
      startDate = dateFrom;
      endDate = dateTo;
    }

    return orders.filter((order) => {
      if (filter === "active" && (!order.session_id || !activeSessionIds.has(order.session_id))) return false;
      if (filter !== "active" && filter !== "all" && order.status !== filter) return false;

      const orderDate = getIndiaDateKey(order.created_at);
      if (startDate && orderDate < startDate) return false;
      if (endDate && orderDate > endDate) return false;

      const tableNumber = String(order.table_number || order.table_id || "1");
      if (tableFilter !== "all" && tableNumber !== tableFilter) return false;
      if (paymentFilter === "paid" && !order.is_paid) return false;
      if (paymentFilter === "unpaid" && order.is_paid) return false;

      if (normalizedSearch) {
        const searchable = [
          order.id,
          tableNumber,
          order.guest_name,
          order.customer_name,
          order.customer_phone,
          ...(order.order_items ?? []).map((item) => item.item_name),
        ].join(" ").toLowerCase();
        if (!searchable.includes(normalizedSearch)) return false;
      }
      return true;
    });
  }, [orders, activeSessions, filter, dateRange, dateFrom, dateTo, tableFilter, paymentFilter, searchQuery]);

  const visibleTableGroups = useMemo(() => {
    const visibleOrderIds = new Set(filteredOrders.map((order) => order.id));
    const hasAdvancedFilters = dateRange !== "all"
      || tableFilter !== "all"
      || paymentFilter !== "all"
      || Boolean(searchQuery.trim());

    return tableGroups
      .map((group) => ({
        ...group,
        visibleOrders: group.orders.filter((order) => visibleOrderIds.has(order.id)),
      }))
      .filter((group) => {
        if (filter === "active" && !hasAdvancedFilters) return group.isCurrentActive;
        return group.visibleOrders!.length > 0;
      });
  }, [tableGroups, filteredOrders, filter, dateRange, tableFilter, paymentFilter, searchQuery]);

  function exportFilteredOrders() {
    const headers = [
      "Order ID", "Date (India)", "Time (India)", "Table", "Session ID", "Guest",
      "Status", "Payment", "Items", "Subtotal", "Discount", "Tax", "Total", "Notes",
    ];
    const rows = filteredOrders.map((order) => [
      order.id,
      formatOrderDate(order.created_at),
      formatOrderTime(order.created_at),
      order.table_number || order.table_id || "1",
      order.session_id ?? "",
      order.guest_name || order.customer_name || "Guest",
      order.status,
      order.is_paid ? "Paid" : "Unpaid",
      (order.order_items ?? []).map((item) => `${item.quantity} x ${item.item_name} @ ${formatINR(item.price)}`).join("; "),
      order.subtotal,
      order.discount ?? 0,
      order.tax,
      order.total,
      order.notes ?? "",
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blobUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `kusum-kunja-orders-${getIndiaDateKey(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Active count strictly reflects the number of currently active table sessions
  const counts: Record<string, number> = {
    all: orders.length,
    active: activeSessions.length,
  };
  orders.forEach((o) => {
    counts[o.status] = (counts[o.status] ?? 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-foreground">
            Table Orders & Kitchen Workflow
          </h2>
          <p className="text-xs text-muted-foreground">
            Accept individual guest orders, track kitchen progression, and settle table bills.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportFilteredOrders}
            disabled={filteredOrders.length === 0}
            className="active:scale-95 transition-all duration-150 hover:shadow-md hover:border-primary/50 hover:bg-primary/5"
          >
            <Download size={14} className="mr-2" />
            Export CSV ({filteredOrders.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchOrders();
              fetchSessions();
            }}
            className="active:scale-95 transition-all duration-150 hover:shadow-md hover:border-primary/50 hover:bg-primary/5"
          >
            <RefreshCw size={14} className="mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Active Tables</p>
          <p className="text-2xl font-bold">{activeSessions.length}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">In Progress Orders</p>
          <p className="text-2xl font-bold text-amber-600">
            {orders.filter((o) => ["pending", "accepted", "preparing", "ready"].includes(o.status)).length}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Served (Ready for Bill)</p>
          <p className="text-2xl font-bold text-teal-600">
            {orders.filter((o) => o.status === "served").length}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-bold">
            ₹{orders.filter(o => o.status !== "cancelled").reduce((sum, o) => sum + Number(o.total || 0), 0)}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {["active", "all", "pending", "accepted", "preparing", "ready", "served", "completed", "cancelled"].map(
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
              {s === "active" ? "Active Tables" : s.charAt(0).toUpperCase() + s.slice(1)}
              {counts[s] !== undefined ? (
                <span className="ml-1 opacity-80">({counts[s]})</span>
              ) : null}
            </button>
          )
        )}
      </div>

      {/* Historical order filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 rounded-xl border border-border bg-card p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Date range
          <select
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value as OrderDateRange)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="all">All dates</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="custom">Custom range</option>
          </select>
        </label>

        {dateRange === "custom" && (
          <>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              From
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => setDateFrom(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              To
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => setDateTo(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              />
            </label>
          </>
        )}

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Table
          <select
            value={tableFilter}
            onChange={(event) => setTableFilter(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="all">All tables</option>
            {tableOptions.map((tableNumber) => (
              <option key={tableNumber} value={tableNumber}>Table {tableNumber}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Payment
          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value as "all" | "paid" | "unpaid")}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="all">Paid & unpaid</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2 xl:col-span-1">
          Search orders
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Order, guest, phone, or item"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </label>
      </div>
      <p className="-mt-4 text-[11px] text-muted-foreground" aria-live="polite">
        Showing {filteredOrders.length} matching {filteredOrders.length === 1 ? "order" : "orders"}. Export uses these filters.
      </p>

      {/* Grouped Table List */}
      <div className="space-y-6">
        {(() => {
          const filteredGroups = visibleTableGroups;

          if (filteredGroups.length === 0) {
            return (
              <div className="text-center py-20 text-muted-foreground border border-dashed border-border/80 bg-card/60 rounded-xl">
                <p className="text-4xl mb-3">{filter === "active" ? "🪑" : "📋"}</p>
                <p className="font-medium text-sm">
                  {filter === "active"
                    ? "No active table sessions right now."
                    : `No orders found for '${filter}'.`}
                </p>
                {filter === "active" && (
                  <p className="text-xs text-muted-foreground/80 mt-1">
                    When guests scan a table QR code, their active session will appear here.
                  </p>
                )}
              </div>
            );
          }

          return filteredGroups.map((group) => {
            const activeSession = group.session;
            // Orders for this group filtered by current tab if applicable
            const displayedOrders =
              group.visibleOrders ?? group.orders;

            // Calculate true table bill without duplicate joins
            const validSessionOrders = group.orders.filter((o) => o.status !== "cancelled");
            const tableTotal = validSessionOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

            // Check unserved orders count
            const unservedCount = validSessionOrders.filter(
              (o) => !["served", "cancelled", "completed"].includes(o.status)
            ).length;

            const canPay = Boolean(activeSession) && validSessionOrders.length > 0 && unservedCount === 0;

            return (
              <div
                key={group.groupKey}
                className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs"
              >
                {/* Table Header with Session Status & Paid Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl font-bold font-serif text-foreground">
                        Table {group.tableNumber}
                      </span>
                      {activeSession ? (
                        <>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#FAF3E6] text-[#8E6314] border border-[#ECD7A9] flex items-center gap-1">
                            <Users size={12} />
                            {activeSession.membersCount} / {activeSession.partySize} Guests
                          </span>
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            (Session #{activeSession.id})
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                          {group.statusLabel || "Past Session"} {group.sessionId ? `(Session #${group.sessionId})` : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {validSessionOrders.length} {validSessionOrders.length === 1 ? "order" : "orders"} placed
                      </span>
                      <span>•</span>
                      <span className="font-bold text-foreground">
                        Total Bill: {formatINR(tableTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Session Actions (Close Session & Paid) */}
                  {activeSession && (
                    <div className="flex flex-col sm:items-end gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Close Session (Unpaid) */}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={closingSessionId === activeSession.id}
                          onClick={() => initiateCloseSession(activeSession, group.orders)}
                          className="text-xs font-medium border-border hover:bg-stone-100 hover:text-stone-900"
                        >
                          <XCircle size={13} className="mr-1.5 text-amber-700" />
                          Close Session
                        </Button>

                        {/* Paid Action */}
                        <Button
                          size="sm"
                          disabled={!canPay || payingSessionId === activeSession.id}
                          onClick={() => handlePaySession(activeSession.id, group.tableNumber, tableTotal)}
                          className={
                            canPay
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                              : "bg-muted text-muted-foreground border border-border text-xs cursor-not-allowed opacity-70"
                          }
                        >
                          <Receipt size={14} className="mr-1.5" />
                          {payingSessionId === activeSession.id
                            ? "Processing Payment..."
                            : `Mark Paid & Close (${formatINR(tableTotal)})`}
                        </Button>
                      </div>

                      {!canPay && (
                        <p className="text-[11px] text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                          <AlertCircle size={11} />
                          {validSessionOrders.length === 0
                            ? "No orders placed yet for this session"
                            : `Must serve or cancel all orders before payment (${unservedCount} in progress)`}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Individual Orders for this Table */}
                {displayedOrders.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl bg-background/50">
                    {group.isCurrentActive
                      ? `No orders placed yet for Table ${group.tableNumber} in this session.`
                      : `No orders matching the current filter for Table ${group.tableNumber}.`}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-1">
                    {[...displayedOrders]
                      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      .map((order) => {
                      const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
                      const nextStep = NEXT_STATUS[order.status];

                      return (
                        <div
                          key={order.id}
                          className={`rounded-xl border p-4 flex flex-col justify-between space-y-3 shadow-2xs transition-all relative overflow-hidden ${
                            order.status === "cancelled"
                              ? "bg-rose-50/30 border-rose-200/60 opacity-60"
                              : order.status === "served"
                              ? "bg-teal-50/20 border-teal-200"
                              : "bg-card border-border hover:border-[#ECD7A9]"
                          }`}
                        >
                          {/* Order Header */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold font-serif text-foreground">
                                  Order #{order.id}
                                </span>
                                <span
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.color}`}
                                >
                                  {cfg.icon} {cfg.label}
                                </span>
                              </div>
                              <button
                                onClick={() => deleteOrder(order.id)}
                                title="Delete order"
                                className="text-muted-foreground/60 hover:text-destructive transition-colors p-1 rounded-md hover:bg-destructive/10"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>

                            {/* Guest identifier & submission time */}
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span className="font-semibold text-stone-700 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                                👤 {order.guest_name || (order.guest_member_id ? `Guest #${order.guest_member_id}` : order.customer_name || "Guest")}
                              </span>
                              <span className="flex flex-col items-end leading-tight">
                                <span>{formatOrderDate(order.created_at)}</span>
                                <span>{formatOrderTime(order.created_at)}</span>
                              </span>
                            </div>
                          </div>

                          {/* Order Items */}
                          <div className="space-y-1 border-t border-border pt-2 text-xs">
                            {order.order_items && order.order_items.length > 0 ? (
                              order.order_items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex justify-between items-center text-muted-foreground"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[9px]">
                                      {item.quantity}
                                    </span>
                                    <span className="text-foreground font-medium text-xs">
                                      {item.item_name}
                                    </span>
                                  </div>
                                  <span className="text-foreground font-semibold text-xs">
                                    ₹{item.price * item.quantity}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground italic">No items recorded</p>
                            )}
                          </div>

                          {order.notes && (
                            <p className="text-[11px] text-muted-foreground italic border-t border-border pt-1.5">
                              Note: {order.notes}
                            </p>
                          )}

                          {/* Order Footer with Individual Status Progression Button */}
                          <div className="flex items-center justify-between border-t border-border pt-2">
                            <div>
                              {Number(order.discount) > 0 ? (
                                <div>
                                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <span>Subtotal: {formatINR(order.subtotal)}</span>
                                    <span className="text-emerald-600 font-semibold">
                                      ({order.promo_code ? `${order.promo_code}: ` : ""}-{formatINR(order.discount)})
                                    </span>
                                  </div>
                                  <p className="text-sm font-bold text-foreground">
                                    {formatINR(order.total)}
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-xs text-muted-foreground">Subtotal</p>
                                  <p className="text-sm font-bold text-foreground">
                                    {formatINR(order.total)}
                                  </p>
                                </div>
                              )}
                            </div>

                            {nextStep && (
                              <Button
                                size="sm"
                                disabled={updatingOrderId === order.id}
                                onClick={() => updateOrderStatus(order.id, nextStep.next)}
                                className="text-xs font-semibold"
                              >
                                {updatingOrderId === order.id ? (
                                  <Loader2 size={12} className="animate-spin mr-1" />
                                ) : null}
                                {nextStep.label}
                              </Button>
                            )}

                            {order.status === "served" && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200 flex items-center gap-1">
                                  <Utensils size={12} /> Served
                                </span>
                                {!order.is_paid && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={updatingOrderId === order.id}
                                    onClick={() => updateOrderStatus(order.id, "completed")}
                                    className="text-xs h-7 px-2 font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                  >
                                    Mark Paid
                                  </Button>
                                )}
                              </div>
                            )}

                            {order.status === "completed" && (
                              <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-full border border-stone-200">
                                ✓ Paid & Closed
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>

      {/* Close Session Confirmation Dialog */}
      <Dialog
        open={Boolean(closeSessionModal?.isOpen)}
        onOpenChange={(open) => {
          if (!open) setCloseSessionModal(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-serif text-lg">
              <XCircle className="text-amber-600" size={20} />
              Close Session for Table {closeSessionModal?.tableNumber}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              End guest access for Table {closeSessionModal?.tableNumber} without marking the bill as paid.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            {closeSessionModal?.unresolvedOrders && closeSessionModal.unresolvedOrders.length > 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <AlertCircle size={15} className="text-amber-700 shrink-0" />
                  <span>
                    ⚠️ {closeSessionModal.unresolvedOrders.length} Unresolved Order(s) in Progress
                  </span>
                </div>
                <p className="text-[11px] text-amber-900/80 leading-relaxed">
                  The following orders have not been served or cancelled yet. They remain open for staff to continue kitchen prep and review:
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {closeSessionModal.unresolvedOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="bg-background/90 border border-amber-300/50 rounded-lg p-2 text-xs flex justify-between items-center"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <span>Order #{ord.id}</span>
                          <span className="text-[10px] font-normal text-muted-foreground">
                            ({ord.guest_name || "Guest"})
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                          {ord.order_items?.map((it) => `${it.quantity}x ${it.item_name}`).join(", ") || "Items"}
                        </p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-amber-100 text-amber-800 border-amber-300">
                          {ord.status}
                        </span>
                        <div className="text-[11px] font-bold text-foreground">
                          {formatINR(ord.total)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-muted-foreground">
                All placed orders for Table {closeSessionModal?.tableNumber} are already served or cancelled.
              </div>
            )}

            <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1.5 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground text-xs">When you close this session:</p>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>Guest QR access will be immediately revoked and disconnected.</li>
                <li>The bill will remain <strong>UNPAID</strong> (payment is not recorded).</li>
                <li>All orders and history are <strong>100% PRESERVED</strong> for kitchen staff review.</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCloseSessionModal(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={closingSessionId === closeSessionModal?.sessionId}
              onClick={() => {
                if (closeSessionModal) {
                  handleConfirmCloseSession(closeSessionModal.sessionId, closeSessionModal.tableNumber);
                }
              }}
              className="text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white"
            >
              {closingSessionId === closeSessionModal?.sessionId ? (
                <>
                  <Loader2 size={12} className="animate-spin mr-1.5" />
                  Closing Session...
                </>
              ) : (
                `Close Session (Leave Unpaid)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
