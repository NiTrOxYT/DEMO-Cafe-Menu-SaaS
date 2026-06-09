import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Clock, ChefHat, CheckCircle, Sparkles, Receipt } from "lucide-react";

const DARK = "#080706";
const DARK_CARD = "#141210";
const DARK_ELEVATED = "#1c1916";
const CREAM = "#f5f0e8";
const MUTED = "#8a8278";
const AMBER = "#c9a96e";
const AMBER_LIGHT = "#e8d4a8";
const BORDER = "rgba(255,255,255,0.07)";
const GOLD_GRADIENT = "linear-gradient(135deg, #b8924f 0%, #e8d4a8 45%, #c9a96e 100%)";

const STATUS_META: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; step: number }> = {
  pending: {
    label: "Order received",
    icon: <Clock size={16} />,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    step: 1,
  },
  preparing: {
    label: "Being prepared",
    icon: <ChefHat size={16} />,
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.12)",
    step: 2,
  },
  ready: {
    label: "Ready to serve",
    icon: <Sparkles size={16} />,
    color: AMBER,
    bg: "rgba(201,169,110,0.15)",
    step: 3,
  },
  completed: {
    label: "Served",
    icon: <CheckCircle size={16} />,
    color: "#34d399",
    bg: "rgba(52,211,153,0.12)",
    step: 4,
  },
};

const STEPS = [
  { key: "pending", label: "Received" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Served" },
];

function formatINR(amount: number) {
  return `₹${Math.round(amount)}`;
}

export default function CurrentOrder() {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestOrder();

    const channel = supabase
      .channel("live-order")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchLatestOrder();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchLatestOrder() {
    const tableNumber = new URLSearchParams(window.location.search).get("table");
    const orderId = localStorage.getItem(`activeOrderId_${tableNumber}`);

    if (!orderId) {
      setOrder(null);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("orders")
      .select("*, order_items (*)")
      .eq("id", orderId)
      .single();

    if (!data) {
      setOrder(null);
      setLoading(false);
      return;
    }

    if (data.is_paid || data.is_active === false) {
      localStorage.removeItem(`activeOrderId_${tableNumber}`);
      setOrder(null);
      setLoading(false);
      return;
    }

    setOrder(data);
    setLoading(false);
  }

  if (loading) {
    return (
      <div style={{ background: DARK, minHeight: "100dvh" }} className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center animate-pulse"
            style={{ background: "rgba(201,169,110,0.15)", border: `1px solid rgba(201,169,110,0.3)` }}
          >
            <span style={{ color: AMBER, fontSize: 20 }}>☕</span>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] font-semibold" style={{ color: MUTED }}>
            Loading order...
          </p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div
        style={{ background: DARK, minHeight: "100dvh" }}
        className="flex flex-col items-center justify-center px-6 text-center"
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: "rgba(201,169,110,0.1)", border: `1px solid rgba(201,169,110,0.2)` }}
        >
          <Receipt size={28} style={{ color: AMBER }} />
        </div>
        <p className="text-[10px] uppercase tracking-[0.25em] font-semibold mb-3" style={{ color: AMBER }}>
          No Active Order
        </p>
        <h1 className="font-serif text-2xl font-bold mb-3" style={{ color: CREAM }}>
          Nothing brewing yet
        </h1>
        <p className="text-sm mb-8" style={{ color: MUTED }}>
          Place an order from the menu and it'll appear here.
        </p>
        <button
          onClick={() => (window.location.href = "/")}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:brightness-110"
          style={{ background: GOLD_GRADIENT, color: DARK }}
        >
          Back to Menu
        </button>
      </div>
    );
  }

  const status = order.status || "pending";
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  const currentStep = meta.step;

  const subtotal = order.subtotal ?? order.order_items?.reduce((s: number, i: any) => s + i.price * i.quantity, 0) ?? 0;
  const tax = order.tax ?? 0;
  const total = order.total ?? subtotal + tax;

  return (
    <div style={{ background: DARK, minHeight: "100dvh", color: CREAM }} className="pb-24">
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `radial-gradient(ellipse 70% 40% at 50% -10%, rgba(201,169,110,0.08), transparent 70%)`,
        }}
      />

      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center gap-4 px-5 h-16 border-b"
        style={{
          background: "rgba(8,7,6,0.85)",
          backdropFilter: "blur(20px)",
          borderColor: BORDER,
        }}
      >
        <button
          onClick={() => window.history.back()}
          className="flex items-center justify-center w-9 h-9 rounded-full transition-all hover:opacity-70"
          style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}` }}
        >
          <ArrowLeft size={16} style={{ color: AMBER }} />
        </button>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: AMBER }}>
            Live Order
          </p>
          <h1 className="font-serif text-base font-bold" style={{ color: CREAM }}>
            Order #{order.id}
          </h1>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold"
          style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}33` }}
        >
          {meta.icon}
          {meta.label}
        </div>
      </header>

      <div className="relative z-10 max-w-lg mx-auto px-5 pt-6 space-y-5">
        {/* Progress tracker */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl p-5"
          style={{ background: DARK_CARD, border: `1px solid ${BORDER}` }}
        >
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-4" style={{ color: MUTED }}>
            Order Progress
          </p>
          <div className="flex items-center gap-0">
            {STEPS.map((step, i) => {
              const stepMeta = STATUS_META[step.key];
              const done = stepMeta.step <= currentStep;
              const active = stepMeta.step === currentStep;
              const isLast = i === STEPS.length - 1;

              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-2">
                    <motion.div
                      animate={{
                        scale: active ? [1, 1.15, 1] : 1,
                        boxShadow: active ? [`0 0 0 0px ${AMBER}40`, `0 0 0 8px ${AMBER}00`] : "none",
                      }}
                      transition={{ duration: 1.5, repeat: active ? Infinity : 0 }}
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{
                        background: done ? (active ? GOLD_GRADIENT : "rgba(201,169,110,0.25)") : "rgba(255,255,255,0.05)",
                        border: `2px solid ${done ? AMBER : "rgba(255,255,255,0.1)"}`,
                      }}
                    >
                      {done ? (
                        active ? (
                          <span style={{ color: DARK, fontSize: 14 }}>{stepMeta.icon}</span>
                        ) : (
                          <CheckCircle size={14} style={{ color: AMBER }} />
                        )
                      ) : (
                        <span className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
                      )}
                    </motion.div>
                    <span
                      className="text-[9px] uppercase tracking-[0.12em] font-semibold whitespace-nowrap"
                      style={{ color: done ? AMBER_LIGHT : MUTED }}
                    >
                      {step.label}
                    </span>
                  </div>
                  {!isLast && (
                    <div
                      className="flex-1 h-0.5 mb-5 mx-1"
                      style={{
                        background: stepMeta.step < currentStep
                          ? `linear-gradient(to right, ${AMBER}, ${AMBER}88)`
                          : "rgba(255,255,255,0.08)",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Table info */}
        {order.table_id && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-between px-5 py-3 rounded-xl"
            style={{ background: "rgba(201,169,110,0.08)", border: `1px solid rgba(201,169,110,0.2)` }}
          >
            <span className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: MUTED }}>Table</span>
            <span className="font-serif font-bold" style={{ color: AMBER_LIGHT }}>{order.table_id}</span>
          </motion.div>
        )}

        {/* Order items */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: DARK_CARD, border: `1px solid ${BORDER}` }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: BORDER }}>
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: MUTED }}>
              Your Items
            </p>
          </div>
          <div className="divide-y" style={{ borderColor: BORDER }}>
            {order.order_items?.map((item: any, idx: number) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + idx * 0.05 }}
                className="flex items-center justify-between px-5 py-4 gap-4"
                style={{ borderColor: BORDER }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                    style={{ background: GOLD_GRADIENT, color: DARK }}
                  >
                    {item.quantity}
                  </span>
                  <span className="text-sm font-medium" style={{ color: CREAM }}>
                    {item.item_name}
                  </span>
                </div>
                <span className="text-sm font-semibold flex-shrink-0" style={{ color: AMBER_LIGHT }}>
                  {formatINR(item.price * item.quantity)}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Bill summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl p-5 space-y-3"
          style={{ background: DARK_CARD, border: `1px solid ${BORDER}` }}
        >
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-4" style={{ color: MUTED }}>
            Summary
          </p>
          <div className="flex justify-between items-center text-sm">
            <span style={{ color: MUTED }}>Subtotal</span>
            <span style={{ color: CREAM }}>{formatINR(subtotal)}</span>
          </div>
          {tax > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span style={{ color: MUTED }}>Tax</span>
              <span style={{ color: CREAM }}>{formatINR(tax)}</span>
            </div>
          )}
          <div
            className="flex justify-between items-center pt-3 border-t"
            style={{ borderColor: BORDER }}
          >
            <span className="font-serif text-lg font-bold" style={{ color: AMBER }}>Grand Total</span>
            <span className="font-serif text-2xl font-bold" style={{ color: AMBER_LIGHT }}>
              {formatINR(total)}
            </span>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col gap-3"
        >
          <button
            onClick={() => (window.location.href = `/bill?id=${order.id}`)}
            className="w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98]"
            style={{
              background: GOLD_GRADIENT,
              color: DARK,
              boxShadow: "0 8px 24px rgba(201,169,110,0.3)",
            }}
          >
            <Receipt size={16} />
            View Full Bill
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all hover:opacity-80"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${BORDER}`,
              color: CREAM,
            }}
          >
            Add More Items
          </button>
        </motion.div>
      </div>
    </div>
  );
}