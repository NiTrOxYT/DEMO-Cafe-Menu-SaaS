import { useState, useEffect, useRef, useCallback } from "react";
import { Gift } from "lucide-react";
import { REWARDS_CONFIG } from "@/config/rewards";
import { supabase } from "@/lib/supabase";
import {
  useListMenuItems,
  useListCategories,
  useGetSettings,
  useCreateOrder,
} from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  Plus,
  Minus,
  Flame,
  Leaf,
  Star,
  ChevronDown,
  MessageCircle,
  Sparkles,
  ArrowRight,
  ClipboardList,
  ShoppingBag,
} from "lucide-react";

const DARK = "#FAF8F5";
const DARK_CARD = "#FFFFFF";
const DARK_ELEVATED = "#F5F0E8";
const CREAM = "#1C1815";
const MUTED = "#78716A";
const AMBER = "#B58428";
const AMBER_LIGHT = "#9C6F1E";
const GREEN = "#2E8540";
const RED = "#D84040";
const BORDER = "#E8E2D8";
const GOLD_GRADIENT =
  "linear-gradient(135deg, #B58428 0%, #D4A84D 45%, #9C6F1E 100%)";
const CARD_SHADOW = "0 2px 14px rgba(28,24,21,0.04), 0 0 0 1px rgba(232,226,216,0.8)";

function formatINR(amount: number) {
  return `₹${Math.round(amount)}`;
}

function getImageSrc(imageUrl: string | undefined | null): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("/objects/")) return `/api/storage${imageUrl}`;
  return imageUrl;
}

type CartItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
};

type MenuItem = {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  categoryId: number;
  categoryName?: string | null;
  available: boolean;
  sortOrder: number;
  isVeg: boolean;
  isBestseller: boolean;
  isSpicy: boolean;
};

function SectionHeader({
  label,
  title,
}: {
  label: string;
  title: string;
}) {
  return (
    <div className="mb-6">
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.22em] mb-1.5"
        style={{ color: AMBER }}
      >
        {label}
      </p>
      <div className="flex items-center gap-4">
        <h2
          className="font-serif text-2xl md:text-3xl font-bold"
          style={{ color: CREAM }}
        >
          {title}
        </h2>
        <div
          className="flex-1 h-px"
          style={{
            background: `linear-gradient(to right, ${AMBER}66, transparent)`,
          }}
        />
      </div>
    </div>
  );
}

// ---------- Badges ----------
function VegBadge({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{
        width: 18,
        height: 18,
        border: `2px solid ${isVeg ? GREEN : RED}`,
        borderRadius: 3,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: isVeg ? GREEN : RED,
          display: "block",
        }}
      />
    </span>
  );
}

// ---------- Cart Context ----------
function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const add = useCallback((item: MenuItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing)
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          imageUrl: item.imageUrl,
        },
      ];
    });
  }, []);

  const remove = useCallback((id: number) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (!existing) return prev;
      if (existing.quantity === 1) return prev.filter((i) => i.id !== id);
      return prev.map((i) =>
        i.id === id ? { ...i, quantity: i.quantity - 1 } : i,
      );
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return { items, add, remove, clear, total, count };
}

// ---------- Item Card ----------
function ItemCard({
  item,
  cartQty,
  onAdd,
  onRemove,
  onClick,
}: {
  item: MenuItem;
  cartQty: number;
  onAdd: () => void;
  onRemove: () => void;
  onClick: () => void;
}) {
  const imgSrc = getImageSrc(item.imageUrl);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: DARK_CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 20,
        boxShadow: CARD_SHADOW,
      }}
      className="flex flex-col cursor-pointer group overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-[#B58428]/40 hover:-translate-y-0.5"
      onClick={onClick}
    >
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: "4/3", background: DARK_ELEVATED }}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `radial-gradient(circle at 50% 40%, ${DARK_ELEVATED}, ${DARK_CARD})`,
              color: MUTED,
            }}
          >
            <span style={{ fontSize: 40 }}>☕</span>
          </div>
        )}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(28,24,21,0.18) 0%, transparent 40%)",
          }}
        />
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {item.isBestseller && (
            <span
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{
                background: GOLD_GRADIENT,
                color: "#1C1815",
                boxShadow: "0 2px 8px rgba(181,132,40,0.25)",
              }}
            >
              <Star size={9} fill="#1C1815" /> Bestseller
            </span>
          )}
        </div>
        {!item.available && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: "rgba(250,248,245,0.85)",
              backdropFilter: "blur(4px)",
            }}
          >
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full"
              style={{
                color: MUTED,
                border: `1px solid ${BORDER}`,
                background: "#FFFFFF",
              }}
            >
              Unavailable
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 p-4 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3
              className="font-serif font-semibold text-[15px] leading-snug"
              style={{ color: CREAM }}
            >
              {item.name}
            </h3>
            <VegBadge isVeg={item.isVeg} />
          </div>
          {item.isSpicy && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide mb-1.5 px-2 py-0.5 rounded-full"
              style={{
                color: "#ff8a65",
                background: "rgba(255,138,101,0.12)",
              }}
            >
              <Flame size={10} /> Spicy
            </span>
          )}
          {item.description && (
            <p
              className="text-xs leading-relaxed line-clamp-2"
              style={{ color: MUTED }}
            >
              {item.description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between pt-1">
          <span
            className="font-serif font-bold text-base"
            style={{ color: AMBER_LIGHT }}
          >
            {formatINR(item.price)}
          </span>
          {item.available && (
            <div onClick={(e) => e.stopPropagation()}>
              {cartQty === 0 ? (
                <button
                  onClick={onAdd}
                  className="flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110 active:scale-95"
                  style={{
                    background: GOLD_GRADIENT,
                    color: DARK,
                    boxShadow: "0 4px 14px rgba(201,169,110,0.3)",
                  }}
                >
                  <Plus size={12} /> Add
                </button>
              ) : (
                <div
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5"
                  style={{
                    background: GOLD_GRADIENT,
                    boxShadow: "0 4px 14px rgba(201,169,110,0.3)",
                  }}
                >
                  <button
                    onClick={onRemove}
                    className="text-black hover:opacity-70 transition-opacity"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="text-xs font-bold text-black w-4 text-center">
                    {cartQty}
                  </span>
                  <button
                    onClick={onAdd}
                    className="text-black hover:opacity-70 transition-opacity"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ---------- Item Detail Overlay ----------
function ItemDetailOverlay({
  item,
  cartQty,
  onAdd,
  onRemove,
  onClose,
}: {
  item: MenuItem;
  cartQty: number;
  onAdd: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const imgSrc = getImageSrc(item.imageUrl);

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ background: "rgba(28, 24, 21, 0.45)", backdropFilter: "blur(12px)" }}
        className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-8"
        onClick={onClose}
      >
        <motion.div
          key="panel"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 220 }}
          style={{
            background: DARK_CARD,
            maxHeight: "92dvh",
            border: `1px solid ${BORDER}`,
            boxShadow: "0 24px 60px rgba(28,24,21,0.18)",
          }}
          className="w-full md:max-w-3xl md:rounded-3xl overflow-hidden flex flex-col md:flex-row relative"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <div
            className="absolute top-0 left-0 right-0 h-1 z-10"
            style={{ background: GOLD_GRADIENT }}
          />
          {imgSrc && (
            <div className="w-full md:w-1/2 aspect-[4/3] md:aspect-auto md:min-h-[420px] flex-shrink-0 overflow-hidden bg-[#F5F0E8]">
              <img
                src={imgSrc}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 flex flex-col p-7 md:p-10 overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                {item.categoryName && (
                  <span
                    className="text-[10px] uppercase tracking-[0.22em] font-semibold mb-2 block"
                    style={{ color: AMBER }}
                  >
                    {item.categoryName}
                  </span>
                )}
                <h2
                  className="text-2xl md:text-4xl font-serif font-bold leading-tight"
                  style={{ color: CREAM }}
                >
                  {item.name}
                </h2>
              </div>
              <button
                onClick={onClose}
                style={{
                  color: MUTED,
                  background: "#F5F0E8",
                  border: `1px solid ${BORDER}`,
                }}
                className="hover:opacity-70 mt-1 p-2 rounded-full transition-opacity"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <VegBadge isVeg={item.isVeg} />
              {item.isBestseller && (
                <span
                  className="flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full"
                  style={{ background: GOLD_GRADIENT, color: "#1C1815" }}
                >
                  <Star size={10} fill="#1C1815" /> Bestseller
                </span>
              )}
              {item.isSpicy && (
                <span
                  className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ color: "#D84040", background: "rgba(216,64,64,0.1)" }}
                >
                  <Flame size={12} /> Spicy
                </span>
              )}
            </div>
            {item.description && (
              <p
                className="text-sm leading-relaxed mb-6"
                style={{ color: MUTED }}
              >
                {item.description}
              </p>
            )}
            <div
              className="mt-auto pt-6 border-t flex items-center justify-between"
              style={{ borderColor: BORDER }}
            >
              <span
                className="text-3xl font-serif font-bold"
                style={{ color: AMBER_LIGHT }}
              >
                {formatINR(item.price)}
              </span>
              {item.available ? (
                cartQty === 0 ? (
                  <button
                    onClick={onAdd}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all hover:brightness-110 active:scale-[0.98]"
                    style={{
                      background: GOLD_GRADIENT,
                      color: "#1C1815",
                      boxShadow: "0 4px 16px rgba(181,132,40,0.3)",
                    }}
                  >
                    <Plus size={16} /> Add to Cart
                  </button>
                ) : (
                  <div
                    className="flex items-center gap-3 rounded-xl px-3 py-2"
                    style={{ background: GOLD_GRADIENT, boxShadow: "0 4px 16px rgba(181,132,40,0.3)" }}
                  >
                    <button
                      onClick={onRemove}
                      className="text-black hover:opacity-70"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="font-bold text-black w-5 text-center">
                      {cartQty}
                    </span>
                    <button
                      onClick={onAdd}
                      className="text-black hover:opacity-70"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                )
              ) : (
                <span
                  className="text-sm font-medium px-4 py-2 rounded-xl"
                  style={{ background: "#F5F0E8", color: MUTED, border: `1px solid ${BORDER}` }}
                >
                  Not Available
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ---------- Cart Drawer ----------
function CartDrawer({
  items,
  total,
  onAdd,
  onRemove,
  onClose,
  onPlaceOrder,
  tableNumber,
  whatsappNumber,
  restaurantName,
}: {
  items: CartItem[];
  total: number;
  onAdd: (id: number) => void;
  onRemove: (id: number) => void;
  onClose: () => void;
  onPlaceOrder: () => void;
  tableNumber: string | null;
  whatsappNumber: string | null;
  restaurantName: string;
}) {
  const handleWhatsApp = () => {
    if (!whatsappNumber) return;
    const lines = [`*Order from ${restaurantName}*`];
    if (tableNumber) lines.push(`Table: ${tableNumber}`);
    lines.push("", "*Items:*");
    items.forEach((i) => {
      lines.push(
        `• ${i.name} x${i.quantity} — ${formatINR(i.price * i.quantity)}`,
      );
    });
    lines.push("", `*Total: ${formatINR(total)}*`);
    const text = encodeURIComponent(lines.join("\n"));
    const num = whatsappNumber.replace(/\D/g, "");
    window.open(`https://wa.me/${num}?text=${text}`, "_blank");
    onPlaceOrder();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex justify-end"
        style={{ background: "rgba(28, 24, 21, 0.45)", backdropFilter: "blur(12px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 260 }}
          style={{
            background: DARK_CARD,
            borderLeft: `1px solid ${BORDER}`,
            width: "min(100vw, 420px)",
            boxShadow: "-16px 0 48px rgba(28, 24, 21, 0.15)",
          }}
          className="h-full flex flex-col relative"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ background: GOLD_GRADIENT }}
          />
          <div
            className="flex items-center justify-between p-6 border-b"
            style={{ borderColor: BORDER }}
          >
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1"
                style={{ color: AMBER }}
              >
                Your selection
              </p>
              <h2
                className="text-xl font-serif font-bold"
                style={{ color: CREAM }}
              >
                Your Order
              </h2>
              {tableNumber && (
                <p className="text-xs mt-1" style={{ color: MUTED }}>
                  Table {tableNumber}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ color: MUTED }}
              className="hover:opacity-70"
            >
              <X size={20} />
            </button>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto p-5 space-y-2">
            {items.map((item) => {
              const imgSrc = getImageSrc(item.imageUrl);
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    background: DARK_ELEVATED,
                    border: `1px solid ${BORDER}`,
                  }}
                >
                  {imgSrc ? (
                    <img
                      src={imgSrc}
                      alt={item.name}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center text-xl"
                      style={{ background: "#252219" }}
                    >
                      ☕
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: CREAM }}
                    >
                      {item.name}
                    </p>
                    <p className="text-xs" style={{ color: AMBER }}>
                      {formatINR(item.price)}
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-2 rounded-lg px-2 py-1 flex-shrink-0"
                    style={{
                      background: "rgba(201,169,110,0.15)",
                      border: `1px solid ${AMBER}33`,
                    }}
                  >
                    <button
                      onClick={() => onRemove(item.id)}
                      className="hover:opacity-70"
                      style={{ color: AMBER }}
                    >
                      <Minus size={12} />
                    </button>
                    <span
                      className="text-sm font-bold w-4 text-center"
                      style={{ color: CREAM }}
                    >
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onAdd(item.id)}
                      className="hover:opacity-70"
                      style={{ color: AMBER }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <span
                    className="text-sm font-semibold w-14 text-right flex-shrink-0"
                    style={{ color: CREAM }}
                  >
                    {formatINR(item.price * item.quantity)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div
            className="p-5 border-t space-y-3"
            style={{ borderColor: BORDER }}
          >
            <div
              className="flex justify-between items-center mb-2 p-3 rounded-xl"
              style={{ background: DARK_ELEVATED, border: `1px solid ${BORDER}` }}
            >
              <span
                className="text-xs font-semibold uppercase tracking-[0.14em]"
                style={{ color: MUTED }}
              >
                Total
              </span>
              <span
                className="text-2xl font-serif font-bold"
                style={{ color: AMBER_LIGHT }}
              >
                {formatINR(total)}
              </span>
            </div>
            {whatsappNumber ? (
              <button
                onClick={handleWhatsApp}
                className="w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98]"
                style={{
                  background: "#25D366",
                  color: "#fff",
                  boxShadow: "0 8px 24px rgba(37,211,102,0.3)",
                }}
              >
                <MessageCircle size={18} /> Place Order via WhatsApp
              </button>
            ) : (
              <button
                onClick={onPlaceOrder}
                className="w-full py-3.5 rounded-xl font-bold transition-all hover:brightness-110 active:scale-[0.98]"
                style={{
                  background: GOLD_GRADIENT,
                  color: DARK,
                  boxShadow: "0 8px 24px rgba(201,169,110,0.35)",
                }}
              >
                Place Order
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ---------- Floating Action Order Bar ----------
interface FloatingActionOrderBarProps {
  cartCount: number;
  cartTotal: number;
  activeOrderId: string | null;
  tableNumber: string | null;
  onContinue: () => void;
  visible: boolean;
}

function FloatingActionOrderBar({
  cartCount,
  cartTotal,
  activeOrderId,
  tableNumber,
  onContinue,
  visible,
}: FloatingActionOrderBarProps) {
  const hasItems = cartCount > 0;
  const hasActiveOrder = !hasItems && !!activeOrderId;

  if (!hasItems && !hasActiveOrder) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          layout
          layoutId="floating-order-bar-container"
          initial={{ y: 120, opacity: 0, filter: "blur(8px)" }}
          animate={{
            y: 0,
            opacity: 1,
            filter: "blur(0px)",
            boxShadow: "0 12px 36px rgba(28, 24, 21, 0.12), 0 0 0 1px rgba(181, 132, 40, 0.2)",
          }}
          exit={{ y: 120, opacity: 0, filter: "blur(8px)" }}
          transition={{
            y: { type: "spring", damping: 25, stiffness: 220 },
            opacity: { duration: 0.2 },
            layout: { type: "spring", damping: 26, stiffness: 210 },
          }}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center justify-between w-[calc(100%-32px)] md:w-full md:max-w-[520px] lg:max-w-[480px] h-[64px] px-4 rounded-full floating-order-bar"
          style={{
            background: "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(22px)",
            WebkitBackdropFilter: "blur(22px)",
            border: `1px solid ${BORDER}`,
          }}
        >
          {hasItems ? (
            <div className="flex items-center justify-between w-full">
              {/* Left Section */}
              <div className="flex items-center gap-3">
                <motion.div
                  layout
                  className="flex items-center justify-center w-10 h-10 rounded-full"
                  style={{ background: "rgba(181, 132, 40, 0.1)" }}
                >
                  <motion.div
                    key={`cart-icon-${cartCount}`}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  >
                    <ShoppingBag size={18} style={{ color: AMBER }} />
                  </motion.div>
                </motion.div>
                <div className="flex flex-col items-start leading-tight">
                  <motion.span
                    layout
                    className="font-bold text-[14px]"
                    style={{ color: CREAM }}
                  >
                    Cart
                  </motion.span>
                  <motion.span
                    key={`cart-count-${cartCount}`}
                    initial={{ scale: 0.95, opacity: 0.7 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="text-[11px]"
                    style={{ color: MUTED }}
                  >
                    {cartCount} {cartCount === 1 ? "Item" : "Items"}
                  </motion.span>
                </div>
              </div>

              {/* Middle Section */}
              <div className="flex-1 flex justify-center">
                <motion.span
                  key={`cart-total-${cartTotal}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="font-manrope font-extrabold text-[16px] tracking-wide"
                  style={{ color: CREAM }}
                >
                  {formatINR(cartTotal)}
                </motion.span>
              </div>

              {/* Right Section */}
              <motion.button
                layout
                whileHover={{ y: -1, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.22 }}
                onClick={onContinue}
                className="flex items-center gap-1.5 px-5 py-2.5 h-10 rounded-full font-bold text-xs uppercase tracking-wider hover:brightness-105"
                style={{
                  background: GOLD_GRADIENT,
                  color: "#1C1815",
                  boxShadow: "0 4px 14px rgba(181, 132, 40, 0.28)",
                }}
              >
                Continue <ArrowRight size={14} />
              </motion.button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              {/* Left Section */}
              <div className="flex items-center gap-3">
                <motion.div
                  layout
                  className="flex items-center justify-center w-10 h-10 rounded-full"
                  style={{ background: "rgba(181, 132, 40, 0.1)" }}
                >
                  <ClipboardList size={18} style={{ color: AMBER }} />
                </motion.div>
                <div className="flex flex-col items-start leading-tight">
                  <motion.span
                    layout
                    className="font-bold text-[14px]"
                    style={{ color: CREAM }}
                  >
                    Active Order
                  </motion.span>
                  <motion.span
                    layout
                    className="text-[11px]"
                    style={{ color: MUTED }}
                  >
                    Track status
                  </motion.span>
                </div>
              </div>

              {/* Middle Section (spacer) */}
              <div className="flex-1" />

              {/* Right Section */}
              <motion.button
                layout
                whileHover={{ y: -1, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.22 }}
                onClick={() => {
                  window.location.href = `/current-order?table=${tableNumber}`;
                }}
                className="flex items-center gap-1.5 px-5 py-2.5 h-10 rounded-full font-bold text-xs uppercase tracking-wider hover:brightness-105"
                style={{
                  background: GOLD_GRADIENT,
                  color: "#1C1815",
                  boxShadow: "0 4px 14px rgba(181, 132, 40, 0.28)",
                }}
              >
                Track Order <ArrowRight size={14} />
              </motion.button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Main Menu Page ----------
export default function MenuPage() {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [vegFilter, setVegFilter] = useState<"all" | "veg" | "nonveg">("all");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const categoryBarRef = useRef<HTMLDivElement>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const { data: menuItems = [] } = useListMenuItems(undefined);
  const { data: categories = [] } = useListCategories();
  const { data: settings } = useGetSettings();
  const createOrderMutation = useCreateOrder();

  // Table number from URL
  const tableNumber = new URLSearchParams(window.location.search).get("table");

  const restaurantName = settings?.restaurantName ?? "The Golden Brew";
  const tagline = settings?.tagline ?? "Crafted with passion, served with love";
  const whatsappNumber = settings?.whatsappNumber ?? null;
  const bannerUrl =
    getImageSrc(settings?.bannerUrl) ??
    "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1600&q=80";

  const cart = useCart();

  // Scroll tracking state for Floating Action Order Bar
  const [showOrderBar, setShowOrderBar] = useState(true);
  const lastScrollY = useRef(0);
  const scrollAccumulator = useRef(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const diff = currentScrollY - lastScrollY.current;

          // 1. Always show when at the top (e.g., scroll position <= 20px)
          if (currentScrollY <= 20) {
            setShowOrderBar(true);
            scrollAccumulator.current = 0;
          } else if (Math.abs(diff) >= 10) {
            // Ignore scroll changes smaller than 10px
            if (diff > 0) {
              // Scrolling down
              if (scrollAccumulator.current < 0) {
                scrollAccumulator.current = 0;
              }
              scrollAccumulator.current += diff;
              if (scrollAccumulator.current >= 70) {
                setShowOrderBar(false);
              }
            } else {
              // Scrolling up
              if (scrollAccumulator.current > 0) {
                scrollAccumulator.current = 0;
              }
              scrollAccumulator.current += diff; // diff is negative
              if (Math.abs(scrollAccumulator.current) >= 20) {
                setShowOrderBar(true);
              }
            }
          }

          lastScrollY.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const cartItemById = (id: number) => cart.items.find((i) => i.id === id);

  const handleAddToCart = (item: MenuItem) => cart.add(item);
  const handleRemoveFromCart = (item: MenuItem) => cart.remove(item.id);
  const handleAddById = (id: number) => {
    const item = (menuItems as MenuItem[]).find((i) => i.id === id);
    if (item) cart.add(item);
  };
  const handleRemoveById = (id: number) => cart.remove(id);

  const handlePlaceOrder = async () => {
    if (cart.items.length === 0) return;

    try {
      const existingOrderId = localStorage.getItem(
        `activeOrderId_${tableNumber}`,
      );
      if (existingOrderId) {
        const { data: existingOrder } = await supabase
          .from("orders")
          .select("*")
          .eq("id", existingOrderId)
          .single();

        if (existingOrder) {
          // EXISTING ACTIVE ORDER
          const orderItems = cart.items.map((item) => ({
            order_id: Number(existingOrderId),
            item_name: item.name,
            quantity: item.quantity,
            price: item.price,
          }));

          await supabase.from("order_items").insert(orderItems);

          await supabase
            .from("orders")
            .update({
              subtotal: existingOrder.subtotal + cart.total,
              total: existingOrder.total + cart.total,

              status: ["preparing", "ready", "completed"].includes(
                existingOrder.status,
              )
                ? "pending"
                : existingOrder.status,

              is_updated: true,

              latest_added_items: cart.items.map(
                (item) => `${item.quantity}x ${item.name}`,
              ),
            })
            .eq("id", existingOrderId);

          const rewardEmail = localStorage.getItem("rewardEmail");

          if (rewardEmail) {
            const { data: rewardUser } = await supabase
              .from("rewards_users")
              .select("*")
              .eq("email", rewardEmail)
              .single();

            if (rewardUser) {
              const today = new Date().toISOString().split("T")[0];

              // VISIT LOGIC
              if (rewardUser.last_visit_date !== today) {
                await supabase
                  .from("rewards_users")
                  .update({
                    total_visits: rewardUser.total_visits + 1,
                    last_visit_date: today,
                  })
                  .eq("id", rewardUser.id);

                rewardUser.total_visits += 1;
                rewardUser.last_visit_date = today;
              }

              // STAR LOGIC
              const alreadyEarnedStarToday =
                rewardUser.last_star_date === today;

              if (cart.total >= 500 && !alreadyEarnedStarToday) {
                const newStars = rewardUser.stars + 1;

                await supabase
                  .from("rewards_users")
                  .update({
                    stars: newStars,
                    reward_available: newStars >= 5,
                    last_star_date: today,
                  })
                  .eq("id", rewardUser.id);
              }
            }
          }

          cart.clear();

          setCartOpen(false);

          setOrderPlaced(true);

          setTimeout(() => {
            setOrderPlaced(false);
          }, 4000);

          return;
        }
      }

      // CREATE NEW ORDER
      const { data: order, error } = await supabase
        .from("orders")
        .insert([
          {
            cafe_id: 1,
            table_id: Number(tableNumber || 1),
            status: "pending",
            subtotal: cart.total,
            tax: 0,
            total: cart.total,
            is_active: true,
            is_paid: false,

            is_updated: false,
          },
        ])
        .select()
        .single();

      if (error || !order) {
        console.error(error);
        return;
      }

      localStorage.setItem(`activeOrderId_${tableNumber}`, order.id.toString());

      setActiveOrderId(order.id.toString());

      const orderItems = cart.items.map((item) => ({
        order_id: order.id,

        item_name: item.name,

        quantity: item.quantity,

        price: item.price,
      }));

      await supabase.from("order_items").insert(orderItems);

      const rewardEmail = localStorage.getItem("rewardEmail");

      if (rewardEmail) {
        const { data: rewardUser } = await supabase
          .from("rewards_users")
          .select("*")
          .eq("email", rewardEmail)
          .single();

        if (rewardUser) {
          const today = new Date().toISOString().split("T")[0];

          // VISIT LOGIC
          if (rewardUser.last_visit_date !== today) {
            await supabase
              .from("rewards_users")
              .update({
                total_visits: rewardUser.total_visits + 1,
                last_visit_date: today,
              })
              .eq("id", rewardUser.id);

            rewardUser.total_visits += 1;
            rewardUser.last_visit_date = today;
          }

          // STAR LOGIC
          const alreadyEarnedStarToday = rewardUser.last_star_date === today;

          if (cart.total >= 500 && !alreadyEarnedStarToday) {
            const newStars = rewardUser.stars + 1;

            await supabase
              .from("rewards_users")
              .update({
                stars: newStars,
                reward_available: newStars >= 5,
                last_star_date: today,
              })
              .eq("id", rewardUser.id);
          }
        }
      }

      cart.clear();

      setCartOpen(false);

      setOrderPlaced(true);

      setTimeout(() => {
        setOrderPlaced(false);
      }, 4000);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const checkActiveOrder = async () => {
      const orderId = localStorage.getItem(`activeOrderId_${tableNumber}`);

      if (!orderId) return;

      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      // if order completed OR paid
      if (!data || data.status === "completed" || data.is_paid === true) {
        localStorage.removeItem(`activeOrderId_${tableNumber}`);

        setActiveOrderId(null);

        return;
      }

      setActiveOrderId(orderId);
    };

    checkActiveOrder();
  }, []);

  // Filter items
  const filtered = (menuItems as MenuItem[]).filter((item) => {
    if (!item.available) return false;
    if (selectedCategory !== null && item.categoryId !== selectedCategory)
      return false;
    if (vegFilter === "veg" && !item.isVeg) return false;
    if (vegFilter === "nonveg" && item.isVeg) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sortedCategories = [...categories].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  return (
    <div
      className="relative"
      style={{ background: DARK, minHeight: "100dvh" }}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Minimalist Luxury Editorial Hero */}
      <div className="relative overflow-hidden border-b border-[#E8E2D8] bg-[#FAF8F5] pt-14 pb-12 md:pt-20 md:pb-16 px-6">
        {/* Subtle Ambient Radial Warm Glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 20%, rgba(212,168,77,0.12), transparent 75%)",
          }}
        />

        {/* Delicate Decorative Border Accents */}
        <div className="absolute top-4 left-6 right-6 hidden md:flex items-center justify-between text-[#B58428]/40 text-xs font-mono select-none pointer-events-none">
          <span>❖ ARTISANAL SERVICE</span>
          <span className="h-px flex-1 mx-6 bg-gradient-to-r from-transparent via-[#B58428]/20 to-transparent" />
          <span>FINE DINING ❖</span>
        </div>

        <div className="relative max-w-3xl mx-auto flex flex-col items-center justify-center text-center z-10">
          {/* Table Badge */}
          {tableNumber && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.16em] mb-4 bg-white border border-[#B58428]/35 text-[#1C1815] shadow-[0_2px_10px_rgba(181,132,40,0.12)]"
            >
              <span className="w-2 h-2 rounded-full bg-[#B58428] animate-pulse" />
              Table {tableNumber}
            </motion.div>
          )}

          {/* Subheading / Monogram Crest */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="flex items-center gap-2 mb-3"
          >
            <span className="text-[#B58428] text-xs">✦</span>
            <p className="text-[11px] uppercase tracking-[0.28em] font-bold text-[#B58428]">
              Artisanal Roastery & Kitchen
            </p>
            <span className="text-[#B58428] text-xs">✦</span>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="font-serif text-4xl sm:text-6xl md:text-7xl font-bold mb-4 leading-[1.1] text-[#1C1815] tracking-tight"
          >
            {restaurantName}
          </motion.h1>

          {/* Luxury Filigree Divider */}
          <div className="flex items-center justify-center gap-4 mb-4 w-full max-w-xs">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#B58428]/70" />
            <div className="w-2.5 h-2.5 rotate-45 bg-[#B58428] shadow-[0_0_8px_rgba(181,132,40,0.4)]" />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#B58428]/70" />
          </div>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="font-serif italic text-base sm:text-lg md:text-xl max-w-lg text-[#5C554E] leading-relaxed mb-6"
          >
            {tagline}
          </motion.p>

          {/* Micro Feature Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-[#78716A]"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E8E2D8] shadow-sm">
              <span className="text-[#B58428]">☕</span> Single-Origin
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E8E2D8] shadow-sm">
              <span className="text-[#2E8540]">🌿</span> Fresh Ingredients
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E8E2D8] shadow-sm">
              <span className="text-[#B58428]">⏱</span> 15-20m Avg Prep
            </span>
          </motion.div>
        </div>
      </div>

      <div
        className="sticky top-0 z-30 border-b shadow-sm"
        style={{
          background: "rgba(250,248,245,0.92)",
          backdropFilter: "blur(20px) saturate(1.2)",
          borderColor: BORDER,
        }}
      >
        <div className="max-w-5xl mx-auto px-4 pt-4 pb-2">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: MUTED }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search food & drinks..."
              className="w-full pl-11 pr-10 py-3 rounded-2xl text-sm outline-none transition-all focus:ring-2 focus:ring-[#B58428]/40"
              style={{
                background: "#FFFFFF",
                border: `1px solid ${BORDER}`,
                color: CREAM,
                boxShadow: "0 1px 4px rgba(31,27,24,0.03)",
              }}
            />
            {searchQuery && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2"
                onClick={() => setSearchQuery("")}
              >
                <X size={14} style={{ color: MUTED }} />
              </button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <div
          ref={categoryBarRef}
          className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none"
        >
          <button
            onClick={() => setSelectedCategory(null)}
            className="flex-shrink-0 px-5 py-2 rounded-full text-xs font-bold transition-all duration-300"
            style={{
              background:
                selectedCategory === null ? GOLD_GRADIENT : "#FFFFFF",
              color: selectedCategory === null ? "#FFFFFF" : CREAM,
              border: `1px solid ${
                selectedCategory === null ? "#B58428" : BORDER
              }`,
              boxShadow:
                selectedCategory === null
                  ? "0 4px 16px rgba(181,132,40,0.3)"
                  : "0 1px 3px rgba(31,27,24,0.03)",
            }}
          >
            All
          </button>
          {sortedCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className="flex-shrink-0 px-5 py-2 rounded-full text-xs font-bold transition-all duration-300"
              style={{
                background:
                  selectedCategory === cat.id
                    ? GOLD_GRADIENT
                    : "#FFFFFF",
                color: selectedCategory === cat.id ? "#FFFFFF" : CREAM,
                border: `1px solid ${
                  selectedCategory === cat.id
                    ? "#B58428"
                    : BORDER
                }`,
                boxShadow:
                  selectedCategory === cat.id
                    ? "0 4px 16px rgba(181,132,40,0.3)"
                    : "0 1px 3px rgba(31,27,24,0.03)",
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Veg filter */}
        <div className="flex gap-2 px-4 pb-3">
          {(["all", "veg", "nonveg"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setVegFilter(f)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                background:
                  vegFilter === f
                    ? f === "veg"
                      ? "rgba(46,133,64,0.12)"
                      : f === "nonveg"
                        ? "rgba(216,64,64,0.12)"
                        : "rgba(181,132,40,0.14)"
                    : "#FFFFFF",

                color:
                  vegFilter === f
                    ? f === "veg"
                      ? GREEN
                      : f === "nonveg"
                        ? RED
                        : AMBER
                    : MUTED,

                border:
                  vegFilter === f
                    ? `1px solid ${
                        f === "veg" ? GREEN : f === "nonveg" ? RED : AMBER
                      }`
                    : `1px solid ${BORDER}`,

                boxShadow:
                  vegFilter === f ? "0 2px 8px rgba(181,132,40,0.12)" : "none",
              }}
            >
              {f === "veg" && <Leaf size={10} />}
              {f === "nonveg" && <Flame size={10} />}
              {f === "all" ? "All" : f === "veg" ? "Veg" : "Non-Veg"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10">
        {filtered.length === 0 ? (
          <div
            className="text-center py-20 px-6 rounded-2xl border border-dashed"
            style={{
              borderColor: BORDER,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <Sparkles
              className="mx-auto mb-4"
              size={32}
              style={{ color: AMBER }}
            />
            <h3
              className="font-serif text-xl font-semibold mb-2"
              style={{ color: CREAM }}
            >
              No items found
            </h3>
            <p className="text-sm" style={{ color: MUTED }}>
              Try adjusting your search or filters.
            </p>
          </div>
        ) : (
          <>
            {selectedCategory === null &&
              !searchQuery &&
              vegFilter === "all" &&
              (() => {
                const bestsellers = filtered.filter((i) => i.isBestseller);
                if (bestsellers.length === 0) return null;
                return (
                  <div className="mb-12">
                    <SectionHeader label="Chef's picks" title="Bestsellers" />
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                      {bestsellers.map((item) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          cartQty={cartItemById(item.id)?.quantity ?? 0}
                          onAdd={() => handleAddToCart(item)}
                          onRemove={() => handleRemoveFromCart(item)}
                          onClick={() => setSelectedItem(item)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}

            {/* By category */}
            {selectedCategory !== null || searchQuery || vegFilter !== "all" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                {filtered.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    cartQty={cartItemById(item.id)?.quantity ?? 0}
                    onAdd={() => handleAddToCart(item)}
                    onRemove={() => handleRemoveFromCart(item)}
                    onClick={() => setSelectedItem(item)}
                  />
                ))}
              </div>
            ) : (
              sortedCategories.map((cat) => {
                const catItems = filtered.filter(
                  (i) => i.categoryId === cat.id,
                );
                if (catItems.length === 0) return null;
                return (
                  <div key={cat.id} className="mb-12">
                    <SectionHeader
                      label="Category"
                      title={cat.name}
                    />
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                      {catItems.map((item) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          cartQty={cartItemById(item.id)?.quantity ?? 0}
                          onAdd={() => handleAddToCart(item)}
                          onRemove={() => handleRemoveFromCart(item)}
                          onClick={() => setSelectedItem(item)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* Item Detail Overlay */}
      {selectedItem && (
        <ItemDetailOverlay
          item={selectedItem}
          cartQty={cartItemById(selectedItem.id)?.quantity ?? 0}
          onAdd={() => handleAddToCart(selectedItem)}
          onRemove={() => handleRemoveFromCart(selectedItem)}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* Cart Drawer */}
      {cartOpen && (
        <CartDrawer
          items={cart.items}
          total={cart.total}
          onAdd={handleAddById}
          onRemove={handleRemoveById}
          onClose={() => setCartOpen(false)}
          onPlaceOrder={handlePlaceOrder}
          tableNumber={tableNumber}
          whatsappNumber={whatsappNumber}
          restaurantName={restaurantName}
        />
      )}

      {/* Floating Action Order Bar */}
      <FloatingActionOrderBar
        cartCount={cart.count}
        cartTotal={cart.total}
        activeOrderId={activeOrderId}
        tableNumber={tableNumber}
        onContinue={() => setCartOpen(true)}
        visible={showOrderBar && !cartOpen}
      />

      {/* Order placed toast */}
      <AnimatePresence>
        {orderPlaced && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div
              className="px-6 py-5 rounded-2xl flex flex-col gap-3 items-center"
              style={{
                background: "#FFFFFF",
                border: `1px solid ${BORDER}`,
                boxShadow: "0 16px 40px rgba(28,24,21,0.14)",
              }}
            >
              <p
                className="font-serif font-semibold text-base"
                style={{ color: CREAM }}
              >
                Order placed successfully
              </p>
              <p className="text-xs" style={{ color: MUTED }}>
                Your kitchen has been notified.
              </p>
              <button
                onClick={() => {
                  window.location.href = `/current-order?table=${tableNumber}`;
                }}
                className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:brightness-105"
                style={{
                  background: GOLD_GRADIENT,
                  color: "#1C1815",
                  boxShadow: "0 2px 10px rgba(181,132,40,0.25)",
                }}
              >
                Track Current Order
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rewards Float Button */}
      {REWARDS_CONFIG.enabled && (
        <button
          onClick={() => {
            window.location.href = localStorage.getItem("rewardEmail")
              ? "/rewards-dashboard"
              : "/rewards";
          }}
          className="fixed bottom-24 right-4 z-40 px-4 py-3 rounded-2xl transition-all hover:scale-[1.03] active:scale-[0.98]"
          style={{
            background: "#FFFFFF",
            color: CREAM,
            border: `1px solid rgba(181,132,40,0.35)`,
            boxShadow: "0 8px 24px rgba(28,24,21,0.08)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full"
              style={{ background: GOLD_GRADIENT, boxShadow: "0 2px 8px rgba(181,132,40,0.3)" }}
            >
              <Gift size={14} style={{ color: "#1C1815" }} />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold">
                {localStorage.getItem("rewardEmail")
                  ? "My Rewards"
                  : "Join Rewards"}
              </div>
              <div className="text-[10px]" style={{ color: MUTED }}>
                Earn stars & discounts
              </div>
            </div>
          </div>
        </button>
      )}

      {/* WhatsApp float button */}
      {whatsappNumber && (
        <a
          href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-4 z-40 flex items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95"
          style={{
            background: "#25D366",
            boxShadow: "0 8px 24px rgba(37,211,102,0.4)",
            width: 52,
            height: 52,
          }}
        >
          <MessageCircle size={22} color="white" fill="white" />
        </a>
      )}
    </div>
  );
}
