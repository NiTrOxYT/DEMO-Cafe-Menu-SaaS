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
} from "lucide-react";

const DARK = "#080706";
const DARK_CARD = "#141210";
const DARK_ELEVATED = "#1c1916";
const CREAM = "#f5f0e8";
const MUTED = "#8a8278";
const AMBER = "#c9a96e";
const AMBER_LIGHT = "#e8d4a8";
const GREEN = "#5cb85c";
const RED = "#e05252";
const BORDER = "rgba(255,255,255,0.08)";
const GOLD_GRADIENT =
  "linear-gradient(135deg, #b8924f 0%, #e8d4a8 45%, #c9a96e 100%)";
const CARD_SHADOW = "0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04)";

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
      className="flex flex-col cursor-pointer group overflow-hidden"
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
              "linear-gradient(to top, rgba(8,7,6,0.75) 0%, transparent 55%)",
          }}
        />
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {item.isBestseller && (
            <span
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{
                background: GOLD_GRADIENT,
                color: DARK,
                boxShadow: "0 4px 16px rgba(201,169,110,0.35)",
              }}
            >
              <Star size={9} fill={DARK} /> Bestseller
            </span>
          )}
        </div>
        {!item.available && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: "rgba(8,7,6,0.72)",
              backdropFilter: "blur(4px)",
            }}
          >
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full"
              style={{
                color: MUTED,
                border: `1px solid ${BORDER}`,
                background: "rgba(255,255,255,0.04)",
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
        style={{ background: "rgba(8,7,6,0.88)", backdropFilter: "blur(20px)" }}
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
            boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
          }}
          className="w-full md:max-w-3xl md:rounded-3xl overflow-hidden flex flex-col md:flex-row relative"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <div
            className="absolute top-0 left-0 right-0 h-0.5 z-10"
            style={{ background: GOLD_GRADIENT }}
          />
          {imgSrc && (
            <div className="w-full md:w-1/2 aspect-[4/3] md:aspect-auto md:min-h-[420px] flex-shrink-0 overflow-hidden">
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
                  background: "rgba(255,255,255,0.05)",
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
                  className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: AMBER, color: DARK }}
                >
                  <Star size={10} fill={DARK} /> Bestseller
                </span>
              )}
              {item.isSpicy && (
                <span
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: "#ff7043" }}
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
                      color: DARK,
                      boxShadow: "0 8px 24px rgba(201,169,110,0.35)",
                    }}
                  >
                    <Plus size={16} /> Add to Cart
                  </button>
                ) : (
                  <div
                    className="flex items-center gap-3 rounded-xl px-3 py-2"
                    style={{ background: AMBER }}
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
                  style={{ background: "rgba(255,255,255,0.06)", color: MUTED }}
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
        style={{ background: "rgba(8,7,6,0.75)", backdropFilter: "blur(12px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 260 }}
          style={{
            background: DARK_CARD,
            border: `1px solid ${BORDER}`,
            width: "min(100vw, 420px)",
            boxShadow: "-16px 0 48px rgba(0,0,0,0.45)",
          }}
          className="h-full flex flex-col relative"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <div
            className="absolute top-0 left-0 right-0 h-0.5"
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

      <div
        className="relative overflow-hidden"
        style={{ height: "62dvh", minHeight: 340 }}
      >
        <img
          src={bannerUrl}
          alt="banner"
          className="absolute inset-0 w-full h-full object-cover scale-105"
          style={{ filter: "brightness(0.32) saturate(0.9)" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(8,7,6,0.15) 0%, rgba(8,7,6,0.55) 45%, rgba(8,7,6,0.95) 100%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(201,169,110,0.12), transparent 70%)",
          }}
        />
        <div className="relative h-full flex flex-col items-center justify-center text-center px-6 z-10">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
            {tableNumber && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] border"
                style={{
                  color: AMBER_LIGHT,
                  borderColor: "rgba(201,169,110,0.35)",
                  background: "rgba(201,169,110,0.1)",
                  backdropFilter: "blur(12px)",
                }}
              >
                Table {tableNumber}
              </motion.div>
            )}
            {activeOrderId && (
              <motion.button
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  window.location.href = `/current-order?table=${tableNumber}`;
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all hover:brightness-110"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: CREAM,
                  border: `1px solid ${BORDER}`,
                  backdropFilter: "blur(12px)",
                }}
              >
                Current Order <ArrowRight size={12} />
              </motion.button>
            )}
          </div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-[10px] uppercase tracking-[0.32em] font-semibold mb-4"
            style={{ color: AMBER }}
          >
            Seasonal Menu · 2026
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold mb-5 leading-[1.05]"
            style={{
              color: CREAM,
              textShadow: "0 4px 32px rgba(0,0,0,0.6)",
            }}
          >
            {restaurantName}
          </motion.h1>
          <div
            className="w-16 h-px mb-5"
            style={{ background: GOLD_GRADIENT }}
          />
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-sm md:text-base max-w-lg leading-relaxed"
            style={{ color: "rgba(245,240,232,0.7)" }}
          >
            {tagline}
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          >
            <span
              className="text-[9px] uppercase tracking-[0.2em] font-medium"
              style={{ color: MUTED }}
            >
              Explore
            </span>
            <ChevronDown
              size={20}
              style={{ color: AMBER }}
              className="animate-bounce"
            />
          </motion.div>
        </div>
      </div>

      <div
        className="sticky top-0 z-30 border-b"
        style={{
          background: "rgba(8,7,6,0.82)",
          backdropFilter: "blur(20px) saturate(1.2)",
          borderColor: BORDER,
        }}
      >
        <div className="max-w-5xl mx-auto px-4 pt-4 pb-2">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: MUTED }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search food & drinks..."
              className="w-full pl-10 pr-10 py-3 rounded-2xl text-sm outline-none transition-all focus:ring-2"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${BORDER}`,
                color: CREAM,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
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
                selectedCategory === null ? GOLD_GRADIENT : "rgba(255,255,255,0.04)",
              color: selectedCategory === null ? DARK : CREAM,
              border: `1px solid ${
                selectedCategory === null ? "rgba(232,212,168,0.5)" : BORDER
              }`,
              boxShadow:
                selectedCategory === null
                  ? "0 6px 20px rgba(201,169,110,0.3)"
                  : "none",
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
                    : "rgba(255,255,255,0.04)",
                color: selectedCategory === cat.id ? DARK : CREAM,
                border: `1px solid ${
                  selectedCategory === cat.id
                    ? "rgba(232,212,168,0.5)"
                    : BORDER
                }`,
                boxShadow:
                  selectedCategory === cat.id
                    ? "0 6px 20px rgba(201,169,110,0.3)"
                    : "none",
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
                      ? "rgba(76,175,80,0.18)"
                      : f === "nonveg"
                        ? "rgba(229,57,53,0.18)"
                        : "rgba(201,169,110,0.18)"
                    : "rgba(255,255,255,0.04)",

                color:
                  vegFilter === f
                    ? f === "veg"
                      ? GREEN
                      : f === "nonveg"
                        ? RED
                        : AMBER
                    : CREAM,

                border:
                  vegFilter === f
                    ? `1px solid ${
                        f === "veg" ? GREEN : f === "nonveg" ? RED : AMBER
                      }`
                    : `1px solid ${BORDER}`,

                boxShadow:
                  vegFilter === f ? "0 4px 16px rgba(0,0,0,0.25)" : "none",
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

      {/* Floating Cart Button */}
      <AnimatePresence>
        {cart.count > 0 && !cartOpen && (
          <motion.button
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 260 }}
            onClick={() => setCartOpen(true)}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
            style={{
              background: GOLD_GRADIENT,
              color: DARK,
              boxShadow:
                "0 12px 40px rgba(201,169,110,0.45), 0 0 0 1px rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
            }}
          >
            <span
              className="flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black"
              style={{ background: DARK, color: AMBER_LIGHT }}
            >
              {cart.count}
            </span>
            View Cart
            <span className="font-black">{formatINR(cart.total)}</span>
          </motion.button>
        )}
      </AnimatePresence>

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
                background: DARK_CARD,
                border: `1px solid ${BORDER}`,
                boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
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
                className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:brightness-110"
                style={{
                  background: GOLD_GRADIENT,
                  color: DARK,
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
            background: DARK_CARD,
            color: CREAM,
            border: `1px solid rgba(201,169,110,0.35)`,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full"
              style={{ background: GOLD_GRADIENT }}
            >
              <Gift size={14} style={{ color: DARK }} />
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
