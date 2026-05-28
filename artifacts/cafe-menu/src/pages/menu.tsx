import { useState, useEffect, useRef, useCallback } from "react";
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
  ShoppingCart,
  X,
  Plus,
  Minus,
  Flame,
  Leaf,
  Star,
  ChevronDown,
  MessageCircle,
} from "lucide-react";

const DARK = "#0f0e0c";
const DARK_CARD = "#1c1a17";
const CREAM = "#f0ebe2";
const MUTED = "#7a7265";
const AMBER = "#c9a96e";
const AMBER_LIGHT = "#e8c98a";
const GREEN = "#4caf50";
const RED = "#e53935";
const BORDER = "rgba(255,255,255,0.07)";

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
      transition={{ duration: 0.3 }}
      style={{
        background: DARK_CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        overflow: "hidden",
      }}
      className="flex flex-col cursor-pointer group"
      onClick={onClick}
    >
      {/* Image */}
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: "4/3", background: "#1a1714" }}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ color: MUTED }}
          >
            <span style={{ fontSize: 40 }}>☕</span>
          </div>
        )}
        {/* Badges overlay */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {item.isBestseller && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
              style={{ background: AMBER, color: DARK }}
            >
              <Star size={9} fill={DARK} /> Bestseller
            </span>
          )}
        </div>
        {!item.available && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(2px)",
            }}
          >
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: MUTED }}
            >
              Not Available
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 p-3 flex flex-col justify-between gap-2">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3
              className="font-semibold text-sm leading-snug"
              style={{ color: CREAM }}
            >
              {item.name}
            </h3>
            <VegBadge isVeg={item.isVeg} />
          </div>
          {item.isSpicy && (
            <span
              className="flex items-center gap-1 text-[10px] font-medium mb-1"
              style={{ color: "#ff7043" }}
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
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm" style={{ color: AMBER }}>
            {formatINR(item.price)}
          </span>
          {item.available && (
            <div onClick={(e) => e.stopPropagation()}>
              {cartQty === 0 ? (
                <button
                  onClick={onAdd}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 active:scale-95"
                  style={{ background: AMBER, color: DARK }}
                >
                  <Plus size={12} /> Add
                </button>
              ) : (
                <div
                  className="flex items-center gap-2 rounded-lg px-2 py-1"
                  style={{ background: AMBER }}
                >
                  <button
                    onClick={onRemove}
                    className="text-black hover:opacity-70"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="text-xs font-bold text-black w-4 text-center">
                    {cartQty}
                  </span>
                  <button
                    onClick={onAdd}
                    className="text-black hover:opacity-70"
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
        style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
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
          }}
          className="w-full md:max-w-3xl md:rounded-2xl overflow-hidden flex flex-col md:flex-row"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
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
                  className="text-2xl md:text-3xl font-serif font-bold"
                  style={{ color: CREAM }}
                >
                  {item.name}
                </h2>
              </div>
              <button
                onClick={onClose}
                style={{ color: MUTED }}
                className="hover:opacity-70 mt-1"
              >
                <X size={22} />
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
              <span className="text-3xl font-bold" style={{ color: AMBER }}>
                {formatINR(item.price)}
              </span>
              {item.available ? (
                cartQty === 0 ? (
                  <button
                    onClick={onAdd}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all hover:opacity-90"
                    style={{ background: AMBER, color: DARK }}
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
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
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
            width: "min(100vw, 400px)",
          }}
          className="h-full flex flex-col"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-5 border-b"
            style={{ borderColor: BORDER }}
          >
            <div>
              <h2
                className="text-lg font-serif font-bold"
                style={{ color: CREAM }}
              >
                Your Order
              </h2>
              {tableNumber && (
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>
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
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {items.map((item) => {
              const imgSrc = getImageSrc(item.imageUrl);
              return (
                <div key={item.id} className="flex items-center gap-3">
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
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold" style={{ color: CREAM }}>
                Total
              </span>
              <span className="text-xl font-bold" style={{ color: AMBER }}>
                {formatINR(total)}
              </span>
            </div>
            {whatsappNumber ? (
              <button
                onClick={handleWhatsApp}
                className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95"
                style={{ background: "#25D366", color: "#fff" }}
              >
                <MessageCircle size={18} /> Place Order via WhatsApp
              </button>
            ) : (
              <button
                onClick={onPlaceOrder}
                className="w-full py-3 rounded-xl font-bold transition-all hover:opacity-90 active:scale-95"
                style={{ background: AMBER, color: DARK }}
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

  const restaurantName = settings?.restaurantName ?? "TONGUE TWISTER";
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

      // EXISTING ACTIVE ORDER
      if (existingOrderId) {
        const { data: existingOrder } = await supabase
          .from("orders")
          .select("*")
          .eq("id", existingOrderId)
          .single();

        if (existingOrder) {
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
            })
            .eq("id", existingOrderId);

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
    <div style={{ background: DARK, minHeight: "100dvh" }}>
      {/* Hero */}
      <div
        className="relative overflow-hidden"
        style={{ height: "56dvh", minHeight: 300 }}
      >
        <img
          src={bannerUrl}
          alt="banner"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "brightness(0.38)" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(15,14,12,0.3) 0%, rgba(15,14,12,0.85) 100%)",
          }}
        />
        <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
          {tableNumber && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest border"
              style={{
                color: AMBER,
                borderColor: `${AMBER}44`,
                background: `${AMBER}11`,
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
                window.location.href = "/current-order";
              }}
              className="mb-4 px-4 py-2 rounded-full text-sm font-semibold"
              style={{
                background: "rgba(201,169,110,0.18)",
                color: "#f0ebe2",
                border: "1px solid rgba(201,169,110,0.35)",
                backdropFilter: "blur(12px)",
              }}
            >
              🧾 Current Order
            </motion.button>
          )}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-[11px] uppercase tracking-[0.28em] font-semibold mb-3"
            style={{ color: AMBER }}
          >
            Seasonal Menu · 2026
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-serif text-5xl md:text-7xl font-bold mb-4"
            style={{ color: CREAM, textShadow: "0 2px 24px rgba(0,0,0,0.5)" }}
          >
            {restaurantName}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-sm md:text-base max-w-md"
            style={{ color: "rgba(240,235,226,0.65)" }}
          >
            {tagline}
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2"
          >
            <ChevronDown
              size={22}
              style={{ color: AMBER }}
              className="animate-bounce"
            />
          </motion.div>
        </div>
      </div>

      {/* Sticky filter bar */}
      <div
        className="sticky top-0 z-30 border-b"
        style={{
          background: "rgba(15,14,12,0.9)",
          backdropFilter: "blur(16px)",
          borderColor: BORDER,
        }}
      >
        {/* Search */}
        <div className="max-w-5xl mx-auto px-4 pt-3 pb-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: MUTED }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search food & drinks..."
              className="w-full pl-8 pr-4 py-2 rounded-xl text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${BORDER}`,
                color: CREAM,
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
            className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: selectedCategory === null ? AMBER : "transparent",
              color: selectedCategory === null ? DARK : MUTED,
              border: `1px solid ${selectedCategory === null ? AMBER : BORDER}`,
            }}
          >
            All
          </button>
          {sortedCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: selectedCategory === cat.id ? AMBER : "transparent",
                color: selectedCategory === cat.id ? DARK : MUTED,
                border: `1px solid ${selectedCategory === cat.id ? AMBER : BORDER}`,
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
                      ? `${GREEN}22`
                      : f === "nonveg"
                        ? `${RED}22`
                        : `${AMBER}22`
                    : "transparent",
                color:
                  vegFilter === f
                    ? f === "veg"
                      ? GREEN
                      : f === "nonveg"
                        ? RED
                        : AMBER
                    : MUTED,
                border: `1px solid ${vegFilter === f ? (f === "veg" ? GREEN : f === "nonveg" ? RED : AMBER) : BORDER}`,
              }}
            >
              {f === "veg" && <Leaf size={10} />}
              {f === "nonveg" && <Flame size={10} />}
              {f === "all" ? "All" : f === "veg" ? "Veg" : "Non-Veg"}
            </button>
          ))}
        </div>
      </div>

      {/* Menu grid */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">🔍</p>
            <p style={{ color: MUTED }}>No items found</p>
          </div>
        ) : (
          <>
            {/* Bestsellers section (when no filters active) */}
            {selectedCategory === null &&
              !searchQuery &&
              vegFilter === "all" &&
              (() => {
                const bestsellers = filtered.filter((i) => i.isBestseller);
                if (bestsellers.length === 0) return null;
                return (
                  <div className="mb-10">
                    <h2
                      className="font-serif text-2xl font-bold mb-5"
                      style={{ color: CREAM }}
                    >
                      ⭐ Bestsellers
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                  <div key={cat.id} className="mb-10">
                    <h2
                      className="font-serif text-2xl font-bold mb-5"
                      style={{ color: CREAM }}
                    >
                      {cat.name}
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl font-bold text-sm"
            style={{
              background: AMBER,
              color: DARK,
              boxShadow: "0 8px 32px rgba(201,169,110,0.4)",
            }}
          >
            <span
              className="flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-black"
              style={{ background: DARK, color: AMBER }}
            >
              {cart.count}
            </span>
            View Cart
            <span className="ml-1 font-black">{formatINR(cart.total)}</span>
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
              className="px-5 py-4 rounded-2xl shadow-xl flex flex-col gap-3 items-center"
              style={{
                background: "#1c1a17",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <p className="font-semibold text-sm" style={{ color: "#f0ebe2" }}>
                ✅ Order Placed Successfully
              </p>

              <button
                onClick={() => {
                  window.location.href = "/current-order";
                }}
                className="px-4 py-2 rounded-xl font-semibold text-sm"
                style={{
                  background: "#c9a96e",
                  color: "#0f0e0c",
                }}
              >
                Track Current Order
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp float button */}
      {whatsappNumber && (
        <a
          href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-4 z-40 flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-transform hover:scale-110"
          style={{ background: "#25D366" }}
        >
          <MessageCircle size={22} color="white" fill="white" />
        </a>
      )}
    </div>
  );
}
