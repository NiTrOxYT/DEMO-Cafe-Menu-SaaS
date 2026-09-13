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
  X,
  Plus,
  Minus,
  Flame,
  Leaf,
  Star,
  ShoppingBag,
  Heart,
  ArrowRight,
  Sparkles,
  Coffee,
  UtensilsCrossed,
  Cake,
  CupSoda,
  Menu as MenuIcon,
  Home as HomeIcon,
  Tag,
  MapPin,
  User,
  Crown,
  ChevronRight,
  MessageCircle,
  Clock,
  Award,
  Check,
} from "lucide-react";

// --- Color System Tokens ---
const BG_WARM = "#F8F5EF";
const BG_SECONDARY = "#EFE7DA";
const BG_CARD = "#FFFDF9";
const TEXT_PRIMARY = "#29231F";
const TEXT_SECONDARY = "#766B61";
const COFFEE_BROWN = "#7B4E35";
const WARM_ACCENT = "#A86E4D";
const MUTED_OLIVE = "#737D63";
const BORDER_COLOR = "#E5DDD1";
const GOLD_BADGE = "#D4A84D";

// Fallback high-end artisanal food photography
const DEFAULT_HERO_LATTE =
  "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=1000&q=85";
const DEFAULT_SEASONAL_DISH =
  "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=85";

const FALLBACK_CATEGORY_IMAGES: Record<string, string> = {
  coffee:
    "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
  breakfast:
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80",
  starters:
    "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=800&q=80",
  "main course":
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
  desserts:
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80",
  beverages:
    "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
};

function formatINR(amount: number) {
  return `₹${Math.round(amount)}`;
}

function getImageSrc(imageUrl: string | undefined | null, fallbackKey?: string): string {
  if (imageUrl) {
    if (imageUrl.startsWith("/objects/")) return `/api/storage${imageUrl}`;
    return imageUrl;
  }
  if (fallbackKey) {
    const key = fallbackKey.toLowerCase();
    for (const [k, v] of Object.entries(FALLBACK_CATEGORY_IMAGES)) {
      if (key.includes(k)) return v;
    }
  }
  return "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80";
}

// --- Botanical Leaf SVG Decoration ---
function BotanicalLeaf({ className = "w-6 h-6", color = MUTED_OLIVE }: { className?: string; color?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 1 9.2A7 7 0 0 1 11 20z" />
      <path d="m9 11 4 4" />
    </svg>
  );
}

// --- Category Icon Helper ---
function getCategoryIcon(name: string, size = 18) {
  const n = name.toLowerCase();
  if (n.includes("coffee") || n.includes("brew") || n.includes("hot")) return <Coffee size={size} />;
  if (n.includes("breakfast") || n.includes("brunch")) return <UtensilsCrossed size={size} />;
  if (n.includes("starter") || n.includes("snack") || n.includes("salad")) return <Leaf size={size} />;
  if (n.includes("dessert") || n.includes("cake") || n.includes("sweet")) return <Cake size={size} />;
  if (n.includes("drink") || n.includes("beverage") || n.includes("shake") || n.includes("cooler"))
    return <CupSoda size={size} />;
  return <UtensilsCrossed size={size} />;
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
  badge?: "BESTSELLER" | "CHEF'S PICK" | "NEW" | null;
};

// --- Custom Cart Hook ---
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

// --- Editorial Food Card ---
function FoodCard({
  item,
  cartQty,
  onAdd,
  onRemove,
  onClick,
  isFavorite,
  onToggleFavorite,
}: {
  item: MenuItem;
  cartQty: number;
  onAdd: () => void;
  onRemove: () => void;
  onClick: () => void;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
}) {
  const imgSrc = getImageSrc(item.imageUrl, item.categoryName ?? item.name);

  // Derive badge type
  const badgeType = item.badge || (item.isBestseller ? "BESTSELLER" : null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="group flex flex-col bg-[#FFFDF9] rounded-2xl border border-[#E5DDD1] overflow-hidden shadow-[0_3px_12px_rgba(41,35,31,0.03)] hover:shadow-[0_8px_24px_rgba(41,35,31,0.08)] hover:border-[#D8CEBF] transition-all duration-300 cursor-pointer"
      onClick={onClick}
    >
      {/* Food Image Container */}
      <div className="relative aspect-[4/3] sm:aspect-[4/3] overflow-hidden bg-[#EFE7DA]">
        <img
          src={imgSrc}
          alt={item.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
        />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
          {badgeType === "BESTSELLER" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.08em] bg-[#EFE7DA]/95 backdrop-blur-xs text-[#7B4E35] border border-[#D4A84D]/40 shadow-xs">
              <Star size={9} fill="#7B4E35" /> BESTSELLER
            </span>
          )}
          {badgeType === "CHEF'S PICK" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.08em] bg-[#7B4E35]/90 backdrop-blur-xs text-white shadow-xs">
              <Crown size={9} /> CHEF'S PICK
            </span>
          )}
          {badgeType === "NEW" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.08em] bg-[#737D63]/90 backdrop-blur-xs text-white shadow-xs">
              <Sparkles size={9} /> NEW
            </span>
          )}
        </div>

        {/* Favorite Heart Button */}
        <button
          type="button"
          onClick={onToggleFavorite}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-[#766B61] hover:text-[#D84040] hover:bg-white transition-colors z-10 shadow-xs"
          aria-label="Add to favorites"
        >
          <Heart size={14} fill={isFavorite ? "#D84040" : "none"} color={isFavorite ? "#D84040" : "currentColor"} />
        </button>

        {/* Unavailable Overlay */}
        {!item.available && (
          <div className="absolute inset-0 bg-[#F8F5EF]/85 backdrop-blur-xs flex items-center justify-center z-10">
            <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#766B61] bg-white px-3 py-1 rounded-full border border-[#E5DDD1]">
              Unavailable
            </span>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-2.5">
        <div>
          <div className="flex items-start justify-between gap-1.5 mb-1">
            <h3 className="font-serif font-bold text-[15px] sm:text-[16px] text-[#29231F] leading-snug group-hover:text-[#7B4E35] transition-colors">
              {item.name}
            </h3>
            {/* Veg / Non-Veg Indicator */}
            <span
              className="mt-0.5 inline-flex items-center justify-center w-3.5 h-3.5 flex-shrink-0 rounded-[2px] border"
              style={{
                borderColor: item.isVeg ? "#2E8540" : "#D84040",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: item.isVeg ? "#2E8540" : "#D84040",
                }}
              />
            </span>
          </div>

          {item.description && (
            <p className="text-[12px] text-[#766B61] line-clamp-2 leading-relaxed font-sans">
              {item.description}
            </p>
          )}
        </div>

        {/* Price & Quantity Add Controls */}
        <div className="flex items-center justify-between pt-1 border-t border-[#E5DDD1]/60">
          <span className="font-sans font-bold text-[15px] sm:text-[16px] text-[#29231F]">
            {formatINR(item.price)}
          </span>

          <div onClick={(e) => e.stopPropagation()}>
            {item.available && (
              cartQty === 0 ? (
                <button
                  type="button"
                  onClick={onAdd}
                  className="w-8 h-8 rounded-full bg-[#7B4E35] text-white flex items-center justify-center hover:bg-[#633D28] transition-all transform active:scale-95 shadow-xs"
                  aria-label={`Add ${item.name} to order`}
                >
                  <Plus size={15} />
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-[#EFE7DA] border border-[#D8CEBF] rounded-full px-2 py-0.5 shadow-xs">
                  <button
                    type="button"
                    onClick={onRemove}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[#7B4E35] hover:opacity-75 transition-opacity"
                    aria-label="Decrease quantity"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="text-xs font-bold text-[#29231F] min-w-4 text-center font-sans">
                    {cartQty}
                  </span>
                  <button
                    type="button"
                    onClick={onAdd}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[#7B4E35] hover:opacity-75 transition-opacity"
                    aria-label="Increase quantity"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- Item Detail Modal ---
function ItemDetailModal({
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
  const imgSrc = getImageSrc(item.imageUrl, item.categoryName ?? item.name);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ background: "rgba(41,35,31,0.45)", backdropFilter: "blur(8px)" }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 240 }}
          className="w-full sm:max-w-xl bg-[#FFFDF9] rounded-t-3xl sm:rounded-3xl border border-[#E5DDD1] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-[#29231F] hover:bg-white shadow-md transition-colors"
          >
            <X size={16} />
          </button>

          {/* Modal Image */}
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#EFE7DA]">
            <img src={imgSrc} alt={item.name} className="w-full h-full object-cover" />
            <div className="absolute bottom-3 left-4 flex gap-2">
              {item.isBestseller && (
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#EFE7DA] text-[#7B4E35] border border-[#D4A84D]/40 shadow-xs">
                  ★ Bestseller
                </span>
              )}
              {item.isVeg ? (
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                  🌿 100% Veg
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-800 border border-red-200">
                  🍖 Non-Veg
                </span>
              )}
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-4">
            <div>
              {item.categoryName && (
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#7B4E35] font-semibold mb-1">
                  {item.categoryName}
                </p>
              )}
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#29231F]">
                {item.name}
              </h2>
            </div>

            {item.description && (
              <p className="text-sm text-[#766B61] leading-relaxed font-sans">
                {item.description}
              </p>
            )}

            <div className="pt-4 border-t border-[#E5DDD1] flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#766B61]">Price</p>
                <p className="font-sans text-2xl font-bold text-[#29231F]">
                  {formatINR(item.price)}
                </p>
              </div>

              {item.available ? (
                cartQty === 0 ? (
                  <button
                    onClick={onAdd}
                    className="px-6 py-3 rounded-full bg-[#7B4E35] text-white font-medium text-sm inline-flex items-center gap-2 hover:bg-[#633D28] transition-all shadow-sm"
                  >
                    <Plus size={16} /> Add to Order
                  </button>
                ) : (
                  <div className="flex items-center gap-3 bg-[#EFE7DA] border border-[#D8CEBF] rounded-full px-4 py-2 shadow-xs">
                    <button
                      onClick={onRemove}
                      className="text-[#7B4E35] hover:opacity-70 p-1"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-sm font-bold text-[#29231F] min-w-5 text-center">
                      {cartQty}
                    </span>
                    <button
                      onClick={onAdd}
                      className="text-[#7B4E35] hover:opacity-70 p-1"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )
              ) : (
                <span className="text-xs font-semibold px-4 py-2 rounded-full bg-stone-100 text-stone-500">
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

// --- Cart Slide-Over Drawer ---
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
        style={{ background: "rgba(41,35,31,0.45)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 260 }}
          style={{
            background: BG_CARD,
            borderLeft: `1px solid ${BORDER_COLOR}`,
            width: "min(100vw, 420px)",
          }}
          className="h-full flex flex-col shadow-2xl relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[#E5DDD1]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7B4E35] mb-0.5">
                Your Table Order
              </p>
              <h2 className="font-serif text-2xl font-bold text-[#29231F]">
                Cart Review
              </h2>
              {tableNumber && (
                <p className="text-xs text-[#766B61] mt-0.5">
                  Dining at Table {tableNumber}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#EFE7DA] flex items-center justify-center text-[#29231F] hover:opacity-80 transition-opacity"
            >
              <X size={16} />
            </button>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {items.length === 0 ? (
              <div className="text-center py-16 text-[#766B61]">
                <ShoppingBag size={36} className="mx-auto mb-3 opacity-40 text-[#7B4E35]" />
                <p className="font-serif text-lg font-semibold text-[#29231F]">Your cart is empty</p>
                <p className="text-xs mt-1">Add something delicious from the menu.</p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F5EF] border border-[#E5DDD1]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#29231F] truncate font-serif">
                      {item.name}
                    </p>
                    <p className="text-xs text-[#7B4E35] font-sans font-medium">
                      {formatINR(item.price)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-[#E5DDD1] rounded-full px-2 py-1">
                    <button
                      onClick={() => onRemove(item.id)}
                      className="text-[#7B4E35] hover:opacity-70"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="text-xs font-bold text-[#29231F] min-w-4 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onAdd(item.id)}
                      className="text-[#7B4E35] hover:opacity-70"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                  <span className="text-sm font-bold text-[#29231F] min-w-14 text-right font-sans">
                    {formatINR(item.price * item.quantity)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Footer Checkout */}
          {items.length > 0 && (
            <div className="p-5 border-t border-[#E5DDD1] bg-[#FFFDF9] space-y-3">
              <div className="flex justify-between items-baseline p-3 rounded-xl bg-[#EFE7DA]/60 border border-[#E5DDD1]">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#766B61]">
                  Total Payable
                </span>
                <span className="font-sans text-2xl font-bold text-[#29231F]">
                  {formatINR(total)}
                </span>
              </div>

              {whatsappNumber ? (
                <button
                  onClick={handleWhatsApp}
                  className="w-full py-3.5 rounded-full font-medium text-sm bg-[#25D366] text-white flex items-center justify-center gap-2 hover:brightness-105 transition-all shadow-sm"
                >
                  <MessageCircle size={16} /> Order via WhatsApp
                </button>
              ) : (
                <button
                  onClick={onPlaceOrder}
                  className="w-full py-3.5 rounded-full font-medium text-sm bg-[#7B4E35] text-white flex items-center justify-center gap-2 hover:bg-[#633D28] transition-all shadow-sm"
                >
                  Place Order ({formatINR(total)})
                </button>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// --- Demo Modals: Story, Offers, Locations ---
function StoryModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#FFFDF9] rounded-3xl border border-[#E5DDD1] p-6 sm:p-8 space-y-4 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#EFE7DA] flex items-center justify-center text-[#29231F]"
        >
          <X size={15} />
        </button>
        <div className="flex items-center gap-2 text-[#7B4E35]">
          <BotanicalLeaf className="w-5 h-5" color="#7B4E35" />
          <span className="text-xs uppercase tracking-[0.2em] font-bold">Our Philosophy</span>
        </div>
        <h2 className="font-serif text-3xl font-bold text-[#29231F]">
          Crafted with Passion, Served with Love
        </h2>
        <p className="text-sm text-[#766B61] leading-relaxed">
          Founded in 2026, The Golden Brew is an artisanal coffee house and kitchen rooted in small-batch roasting, farm-fresh local produce, and warm hospitality. Every recipe is thoughtfully designed to bring comfort, community, and inspiration to your table.
        </p>
        <div className="pt-2 flex items-center gap-3 text-xs text-[#7B4E35] font-semibold">
          <span>🌿 100% Organic Beans</span>
          <span>•</span>
          <span>🥖 Artisanal Sourdough</span>
          <span>•</span>
          <span>☕ Micro-Roasts</span>
        </div>
      </div>
    </div>
  );
}

function OffersModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#FFFDF9] rounded-3xl border border-[#E5DDD1] p-6 sm:p-8 space-y-4 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#EFE7DA] flex items-center justify-center text-[#29231F]"
        >
          <X size={15} />
        </button>
        <div className="flex items-center gap-2 text-[#7B4E35]">
          <Tag className="w-4 h-4" />
          <span className="text-xs uppercase tracking-[0.2em] font-bold">Today's Specials</span>
        </div>
        <h2 className="font-serif text-3xl font-bold text-[#29231F]">
          Exclusive Table Rewards
        </h2>
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-[#EFE7DA]/70 border border-[#D8CEBF] flex justify-between items-center">
            <div>
              <p className="font-bold text-[#29231F] font-serif text-base">Morning Pastry & Brew</p>
              <p className="text-xs text-[#766B61]">Get 20% off any croissant with a hot Cappuccino</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#7B4E35] text-white text-xs font-bold">20% OFF</span>
          </div>
          <div className="p-4 rounded-2xl bg-[#EFE7DA]/70 border border-[#D8CEBF] flex justify-between items-center">
            <div>
              <p className="font-bold text-[#29231F] font-serif text-base">Complimentary Dessert</p>
              <p className="text-xs text-[#766B61]">On table orders above ₹750</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#737D63] text-white text-xs font-bold">FREE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LocationsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#FFFDF9] rounded-3xl border border-[#E5DDD1] p-6 sm:p-8 space-y-4 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#EFE7DA] flex items-center justify-center text-[#29231F]"
        >
          <X size={15} />
        </button>
        <div className="flex items-center gap-2 text-[#7B4E35]">
          <MapPin className="w-4 h-4" />
          <span className="text-xs uppercase tracking-[0.2em] font-bold">Find Us</span>
        </div>
        <h2 className="font-serif text-3xl font-bold text-[#29231F]">
          Café Locations
        </h2>
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-[#F8F5EF] border border-[#E5DDD1]">
            <p className="font-bold text-[#29231F] font-serif text-base">The Golden Brew • Flagship</p>
            <p className="text-xs text-[#766B61] mt-0.5">42 Boulevard Lane, Central District</p>
            <p className="text-[11px] text-[#7B4E35] font-semibold mt-1">Open daily: 7:30 AM – 10:30 PM</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#F8F5EF] border border-[#E5DDD1]">
            <p className="font-bold text-[#29231F] font-serif text-base">The Roastery & Garden</p>
            <p className="text-xs text-[#766B61] mt-0.5">18 Artisans Way, Waterfront Promenade</p>
            <p className="text-[11px] text-[#7B4E35] font-semibold mt-1">Open daily: 8:00 AM – 11:00 PM</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN CUSTOMER-FACING QR MENU PAGE
// ==========================================
export default function MenuPage() {
  const { data: menuItems = [] } = useListMenuItems(undefined);
  const { data: categories = [] } = useListCategories();
  const { data: settings } = useGetSettings();

  // URL query params
  const tableNumber = new URLSearchParams(window.location.search).get("table");

  const restaurantName = settings?.restaurantName ?? "The Golden Brew";
  const tagline = settings?.tagline ?? "Fresh ingredients. Thoughtful recipes. A better you, every day.";
  const whatsappNumber = settings?.whatsappNumber ?? null;

  const cart = useCart();

  // State
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [vegFilter, setVegFilter] = useState<"all" | "veg" | "nonveg">("all");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [activeNav, setActiveNav] = useState("menu");

  // Navigation Modals
  const [showStory, setShowStory] = useState(false);
  const [showOffers, setShowOffers] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active Order state
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const categoryBarRef = useRef<HTMLDivElement>(null);

  const toggleFavorite = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handlePlaceOrder = async () => {
    if (cart.items.length === 0) return;

    try {
      const existingOrderId = localStorage.getItem(`activeOrderId_${tableNumber}`);
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
              status: ["preparing", "ready", "completed"].includes(existingOrder.status)
                ? "pending"
                : existingOrder.status,
              is_updated: true,
              latest_added_items: cart.items.map((item) => `${item.quantity}x ${item.name}`),
            })
            .eq("id", existingOrderId);

          cart.clear();
          setCartOpen(false);
          setOrderPlaced(true);
          setTimeout(() => setOrderPlaced(false), 4000);
          return;
        }
      }

      // Create new order
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

      cart.clear();
      setCartOpen(false);
      setOrderPlaced(true);
      setTimeout(() => setOrderPlaced(false), 4000);
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

      if (!data || data.status === "completed" || data.is_paid === true) {
        localStorage.removeItem(`activeOrderId_${tableNumber}`);
        setActiveOrderId(null);
        return;
      }
      setActiveOrderId(orderId);
    };

    checkActiveOrder();
  }, [tableNumber]);

  // Filtered menu items
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

  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const bestsellers = (menuItems as MenuItem[]).filter((i) => i.isBestseller && i.available);

  return (
    <div className="min-h-screen bg-[#F8F5EF] text-[#29231F] font-sans antialiased selection:bg-[#EFE7DA] selection:text-[#7B4E35]">
      {/* Modals */}
      {showStory && <StoryModal onClose={() => setShowStory(false)} />}
      {showOffers && <OffersModal onClose={() => setShowOffers(false)} />}
      {showLocations && <LocationsModal onClose={() => setShowLocations(false)} />}

      {/* Item Detail Overlay */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          cartQty={cart.items.find((i) => i.id === selectedItem.id)?.quantity ?? 0}
          onAdd={() => cart.add(selectedItem)}
          onRemove={() => cart.remove(selectedItem.id)}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* Cart Drawer */}
      {cartOpen && (
        <CartDrawer
          items={cart.items}
          total={cart.total}
          onAdd={(id) => {
            const item = (menuItems as MenuItem[]).find((i) => i.id === id);
            if (item) cart.add(item);
          }}
          onRemove={(id) => cart.remove(id)}
          onClose={() => setCartOpen(false)}
          onPlaceOrder={handlePlaceOrder}
          tableNumber={tableNumber}
          whatsappNumber={whatsappNumber}
          restaurantName={restaurantName}
        />
      )}

      {/* Mobile Slide-Over Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="w-72 max-w-[80vw] h-full bg-[#FFFDF9] border-r border-[#E5DDD1] p-6 flex flex-col justify-between"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2.5">
                    <BotanicalLeaf className="w-6 h-6" color={COFFEE_BROWN} />
                    <div>
                      <h2 className="font-serif text-lg font-bold text-[#29231F] leading-tight">
                        {restaurantName}
                      </h2>
                      <p className="text-[9px] uppercase tracking-[0.2em] text-[#766B61]">
                        CAFÉ & KITCHEN
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)}>
                    <X size={18} className="text-[#766B61]" />
                  </button>
                </div>

                <nav className="space-y-1.5">
                  {[
                    { id: "home", label: "Home", icon: HomeIcon, action: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
                    { id: "menu", label: "Menu", icon: UtensilsCrossed, action: () => document.getElementById("menu-categories")?.scrollIntoView({ behavior: "smooth" }) },
                    { id: "story", label: "Our Story", icon: BookOpenIcon, action: () => setShowStory(true) },
                    { id: "offers", label: "Offers", icon: Tag, action: () => setShowOffers(true) },
                    { id: "locations", label: "Locations", icon: MapPin, action: () => setShowLocations(true) },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeNav === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveNav(tab.id);
                          setMobileMenuOpen(false);
                          tab.action();
                        }}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-[#EFE7DA] text-[#7B4E35] font-semibold"
                            : "text-[#29231F] hover:bg-[#F8F5EF]"
                        }`}
                      >
                        <Icon size={16} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-6 border-t border-[#E5DDD1] text-center">
                <p className="font-serif italic text-sm text-[#766B61]">
                  "Good Food • Brighter Days"
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container Layout with Desktop Sidebar */}
      <div className="flex min-h-screen">
        {/* ============================================== */}
        {/* DESKTOP SIDEBAR */}
        {/* ============================================== */}
        <aside className="hidden md:flex flex-col w-60 lg:w-68 bg-[#FFFDF9] border-r border-[#E5DDD1] min-h-screen p-6 sticky top-0 h-screen justify-between flex-shrink-0 z-20">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 rounded-xl bg-[#EFE7DA] flex items-center justify-center text-[#7B4E35] flex-shrink-0">
                <BotanicalLeaf className="w-6 h-6" color={COFFEE_BROWN} />
              </div>
              <div>
                <h1 className="font-serif text-lg font-bold text-[#29231F] leading-tight">
                  {restaurantName}
                </h1>
                <p className="text-[9px] uppercase tracking-[0.22em] text-[#766B61] font-semibold">
                  CAFÉ & KITCHEN
                </p>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="space-y-1.5">
              {[
                { id: "home", label: "Home", icon: HomeIcon, action: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
                { id: "menu", label: "Menu", icon: UtensilsCrossed, action: () => document.getElementById("menu-categories")?.scrollIntoView({ behavior: "smooth" }) },
                { id: "story", label: "Our Story", icon: BookOpenIcon, action: () => setShowStory(true) },
                { id: "offers", label: "Offers", icon: Tag, action: () => setShowOffers(true) },
                { id: "locations", label: "Locations", icon: MapPin, action: () => setShowLocations(true) },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeNav === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveNav(tab.id);
                      tab.action();
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#EFE7DA] text-[#7B4E35] font-semibold"
                        : "text-[#29231F] hover:bg-[#F8F5EF]"
                    }`}
                  >
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Bottom Motif */}
          <div className="pt-6 border-t border-[#E5DDD1] text-center space-y-1">
            <BotanicalLeaf className="w-5 h-5 mx-auto mb-1 opacity-70" color={COFFEE_BROWN} />
            <p className="font-serif font-bold text-sm text-[#29231F]">Good Food</p>
            <p className="font-script text-lg text-[#7B4E35]">Brighter Days</p>
          </div>
        </aside>

        {/* ============================================== */}
        {/* MAIN CONTENT AREA */}
        {/* ============================================== */}
        <main className="flex-1 min-w-0 bg-[#F8F5EF] pb-28 md:pb-16">
          {/* MOBILE HEADER */}
          <header className="md:hidden sticky top-0 z-30 bg-[#F8F5EF]/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-[#E5DDD1]">
            <div className="flex items-center gap-2">
              <BotanicalLeaf className="w-5 h-5" color={COFFEE_BROWN} />
              <div>
                <h1 className="font-serif text-base font-bold text-[#29231F] leading-tight">
                  {restaurantName}
                </h1>
                <p className="text-[8px] uppercase tracking-[0.2em] text-[#766B61]">
                  CAFÉ & KITCHEN
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Search Toggle */}
              <button
                onClick={() => document.getElementById("search-input")?.focus()}
                className="w-9 h-9 rounded-full bg-[#FFFDF9] border border-[#E5DDD1] flex items-center justify-center text-[#29231F] shadow-xs"
                aria-label="Search"
              >
                <Search size={15} />
              </button>

              {/* Cart Button */}
              <button
                onClick={() => setCartOpen(true)}
                className="relative w-9 h-9 rounded-full bg-[#FFFDF9] border border-[#E5DDD1] flex items-center justify-center text-[#29231F] shadow-xs"
                aria-label="View Cart"
              >
                <ShoppingBag size={15} />
                {cart.count > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#7B4E35] text-white text-[9px] font-bold flex items-center justify-center">
                    {cart.count}
                  </span>
                )}
              </button>

              {/* Mobile Drawer Trigger */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="w-9 h-9 rounded-full bg-[#FFFDF9] border border-[#E5DDD1] flex items-center justify-center text-[#29231F] shadow-xs"
                aria-label="Open Navigation Menu"
              >
                <MenuIcon size={16} />
              </button>
            </div>
          </header>

          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 md:pt-6 space-y-6 sm:space-y-8">
            {/* DESKTOP TOP BAR (Search & Cart) */}
            <div className="hidden md:flex items-center justify-between gap-4">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <Search
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#766B61]"
                />
                <input
                  id="search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for food, drinks, or mood..."
                  className="w-full pl-11 pr-10 py-3 rounded-full bg-[#FFFDF9] border border-[#E5DDD1] text-sm text-[#29231F] placeholder:text-[#766B61]/70 focus:outline-none focus:border-[#7B4E35] focus:ring-1 focus:ring-[#7B4E35]/30 shadow-xs transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#766B61]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Controls on right */}
              <div className="flex items-center gap-3">
                {tableNumber && (
                  <div className="px-3.5 py-1.5 rounded-full bg-[#FFFDF9] border border-[#E5DDD1] text-xs font-semibold text-[#29231F] flex items-center gap-1.5 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-[#7B4E35]" />
                    Table {tableNumber}
                  </div>
                )}

                {activeOrderId && (
                  <button
                    onClick={() => {
                      window.location.href = `/current-order?table=${tableNumber}`;
                    }}
                    className="px-4 py-2 rounded-full bg-[#EFE7DA] text-[#7B4E35] text-xs font-semibold hover:bg-[#E2D6C5] transition-colors flex items-center gap-1.5"
                  >
                    <Clock size={14} /> Track Order
                  </button>
                )}

                <button
                  onClick={() => setCartOpen(true)}
                  className="relative px-4 py-2.5 rounded-full bg-[#FFFDF9] border border-[#E5DDD1] text-[#29231F] text-xs font-semibold hover:bg-[#F8F5EF] transition-colors flex items-center gap-2 shadow-xs"
                >
                  <ShoppingBag size={16} />
                  <span>Cart</span>
                  {cart.count > 0 && (
                    <span className="w-5 h-5 rounded-full bg-[#7B4E35] text-white text-[10px] font-bold flex items-center justify-center">
                      {cart.count}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* ============================================== */}
            {/* HERO SECTION (Matches Reference Image Exactly) */}
            {/* ============================================== */}
            <section className="relative overflow-hidden rounded-3xl bg-[#F8F5EF] pt-2 pb-6 sm:py-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Left/Top Content Column */}
                <div className="md:col-span-7 space-y-4 sm:space-y-5 z-10">
                  {/* Eyebrow */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-[0.24em] font-semibold text-[#766B61]">
                      GOOD FOOD • GOOD PEOPLE
                    </span>
                  </div>

                  {/* Main Editorial Headline */}
                  <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-[#29231F] leading-[1.08] tracking-tight">
                    More Than <br />
                    Just a Meal
                  </h1>

                  {/* Supporting Copy */}
                  <p className="text-sm sm:text-base text-[#766B61] leading-relaxed max-w-md font-sans">
                    {tagline}
                  </p>

                  {/* CTA Button */}
                  <div className="pt-1 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <button
                      onClick={() => {
                        document.getElementById("menu-categories")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="px-6 py-3 rounded-full bg-[#7B4E35] text-white font-medium text-sm inline-flex items-center gap-2 hover:bg-[#633D28] transition-all transform active:scale-95 shadow-sm"
                    >
                      <span>Explore Menu</span>
                      <ArrowRight size={15} />
                    </button>

                    {/* Handwritten Script Accent (Bottom Left) */}
                    <div className="font-script text-xl sm:text-2xl text-[#7B4E35] -rotate-2 select-none">
                      —— Food Tastes Better Together
                    </div>
                  </div>
                </div>

                {/* Right/Hero Image Column */}
                <div className="md:col-span-5 relative flex items-center justify-center">
                  {/* Handwritten Script Accent (Top Right) */}
                  <div className="absolute -top-3 right-4 sm:top-2 sm:right-6 font-script text-2xl sm:text-3xl text-[#7B4E35] -rotate-6 select-none z-10 leading-tight">
                    Good Food <br /> Good Mood
                  </div>

                  {/* Large Ceramic Coffee Cup Image */}
                  <div className="relative w-full max-w-[340px] sm:max-w-[400px] aspect-square rounded-full flex items-center justify-center">
                    <img
                      src={DEFAULT_HERO_LATTE}
                      alt="Artisanal Café Latte"
                      className="w-full h-full object-contain drop-shadow-[0_20px_35px_rgba(41,35,31,0.18)]"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ============================================== */}
            {/* HORIZONTAL CATEGORY NAVIGATION */}
            {/* ============================================== */}
            <section id="menu-categories" className="space-y-3 pt-2">
              <div
                ref={categoryBarRef}
                className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-none"
              >
                {/* "All" Category Pill */}
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold flex-shrink-0 transition-all ${
                    selectedCategory === null
                      ? "bg-[#7B4E35] text-white shadow-xs"
                      : "bg-[#FFFDF9] text-[#29231F] border border-[#E5DDD1] hover:bg-[#EFE7DA]"
                  }`}
                >
                  <Coffee size={16} />
                  <span>All</span>
                </button>

                {sortedCategories.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold flex-shrink-0 transition-all ${
                        isSelected
                          ? "bg-[#7B4E35] text-white shadow-xs"
                          : "bg-[#FFFDF9] text-[#29231F] border border-[#E5DDD1] hover:bg-[#EFE7DA]"
                      }`}
                    >
                      {getCategoryIcon(cat.name, 16)}
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Veg / Non-Veg Filter Chips */}
              <div className="flex items-center gap-2 pt-1">
                {[
                  { id: "all", label: "All Items" },
                  { id: "veg", label: "Veg Only", icon: Leaf },
                  { id: "nonveg", label: "Non-Veg", icon: Flame },
                ].map((f) => {
                  const isSelected = vegFilter === f.id;
                  const Icon = f.icon;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setVegFilter(f.id as any)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        isSelected
                          ? "bg-[#29231F] text-white"
                          : "bg-[#FFFDF9] text-[#766B61] border border-[#E5DDD1] hover:bg-[#EFE7DA]"
                      }`}
                    >
                      {Icon && <Icon size={12} />}
                      <span>{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ============================================== */}
            {/* CHEF'S PICKS SECTION */}
            {/* ============================================== */}
            {selectedCategory === null && !searchQuery && vegFilter === "all" && bestsellers.length > 0 && (
              <section className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#29231F]">
                      Chef's Picks
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      // Scroll to full menu
                      document.getElementById("full-menu")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#7B4E35] hover:underline"
                  >
                    <span>View All</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
                  {bestsellers.slice(0, 4).map((item) => (
                    <FoodCard
                      key={item.id}
                      item={item}
                      cartQty={cart.items.find((i) => i.id === item.id)?.quantity ?? 0}
                      onAdd={() => cart.add(item)}
                      onRemove={() => cart.remove(item.id)}
                      onClick={() => setSelectedItem(item)}
                      isFavorite={favorites.includes(item.id)}
                      onToggleFavorite={(e) => toggleFavorite(item.id, e)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ============================================== */}
            {/* SEASONAL SPECIALS PROMOTIONAL BANNER */}
            {/* ============================================== */}
            {selectedCategory === null && !searchQuery && (
              <section className="relative overflow-hidden rounded-3xl bg-[#2E3B2D] text-white p-6 sm:p-8 my-4 sm:my-6 shadow-md">
                {/* Background Leaf Decoration */}
                <div className="absolute top-0 right-0 w-48 h-48 opacity-15 pointer-events-none">
                  <BotanicalLeaf className="w-full h-full" color="#FFFFFF" />
                </div>

                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                  <div className="sm:col-span-7 space-y-2.5">
                    <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-[#D0DEC8] font-bold">
                      HANDPICKED FLAVOURS FOR A LIMITED TIME
                    </p>
                    <h3 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">
                      Seasonal Specials
                    </h3>
                    <p className="text-xs sm:text-sm text-[#D0DEC8] max-w-sm font-sans leading-relaxed">
                      Savor this season's farm-to-table salads, infused coolers, and artisan bakes made fresh daily.
                    </p>
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          const dessertsCat = categories.find((c) =>
                            c.name.toLowerCase().includes("dessert") || c.name.toLowerCase().includes("main"),
                          );
                          if (dessertsCat) setSelectedCategory(dessertsCat.id);
                        }}
                        className="px-5 py-2.5 rounded-full bg-[#F8F5EF] text-[#29231F] font-semibold text-xs hover:bg-[#EFE7DA] transition-colors inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <span>Discover Now</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-5 relative flex items-center justify-center">
                    {/* Handwritten script on banner */}
                    <div className="absolute -top-3 right-0 font-script text-xl sm:text-2xl text-[#E5F0DF] -rotate-3 select-none">
                      Fresh Seasonal Local
                    </div>
                    <img
                      src={DEFAULT_SEASONAL_DISH}
                      alt="Seasonal Special Gourmet Bowl"
                      className="w-40 sm:w-52 h-40 sm:h-52 object-cover rounded-full border-2 border-white/20 shadow-xl"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* ============================================== */}
            {/* FULL MENU LISTINGS */}
            {/* ============================================== */}
            <section id="full-menu" className="space-y-8 pt-4">
              {filtered.length === 0 ? (
                <div className="text-center py-20 bg-[#FFFDF9] rounded-3xl border border-[#E5DDD1] p-8">
                  <Sparkles className="mx-auto mb-3 text-[#7B4E35]" size={32} />
                  <h3 className="font-serif text-xl font-bold text-[#29231F] mb-1">
                    No items found
                  </h3>
                  <p className="text-xs text-[#766B61]">
                    Try adjusting your search query or dietary filters.
                  </p>
                </div>
              ) : selectedCategory !== null || searchQuery || vegFilter !== "all" ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-serif text-2xl font-bold text-[#29231F]">
                      {searchQuery
                        ? `Search: "${searchQuery}"`
                        : selectedCategory !== null
                        ? categories.find((c) => c.id === selectedCategory)?.name ?? "Menu Items"
                        : "Menu Items"}
                    </h2>
                    <span className="text-xs text-[#766B61] font-sans">
                      {filtered.length} {filtered.length === 1 ? "item" : "items"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
                    {filtered.map((item) => (
                      <FoodCard
                        key={item.id}
                        item={item}
                        cartQty={cart.items.find((i) => i.id === item.id)?.quantity ?? 0}
                        onAdd={() => cart.add(item)}
                        onRemove={() => cart.remove(item.id)}
                        onClick={() => setSelectedItem(item)}
                        isFavorite={favorites.includes(item.id)}
                        onToggleFavorite={(e) => toggleFavorite(item.id, e)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                sortedCategories.map((cat) => {
                  const catItems = filtered.filter((i) => i.categoryId === cat.id);
                  if (catItems.length === 0) return null;
                  return (
                    <div key={cat.id} className="space-y-4">
                      {/* Category Section Header with Fine Line */}
                      <div className="flex items-center gap-4">
                        <h2 className="font-serif text-2xl font-bold text-[#29231F] flex-shrink-0">
                          {cat.name}
                        </h2>
                        <div className="flex-1 h-px bg-[#E5DDD1]" />
                        <span className="text-xs text-[#766B61] font-sans">
                          {catItems.length} {catItems.length === 1 ? "item" : "items"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
                        {catItems.map((item) => (
                          <FoodCard
                            key={item.id}
                            item={item}
                            cartQty={cart.items.find((i) => i.id === item.id)?.quantity ?? 0}
                            onAdd={() => cart.add(item)}
                            onRemove={() => cart.remove(item.id)}
                            onClick={() => setSelectedItem(item)}
                            isFavorite={favorites.includes(item.id)}
                            onToggleFavorite={(e) => toggleFavorite(item.id, e)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          </div>
        </main>
      </div>

      {/* ============================================== */}
      {/* MOBILE FIXED BOTTOM NAVIGATION BAR */}
      {/* ============================================== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFFDF9]/95 backdrop-blur-md border-t border-[#E5DDD1] flex items-center justify-around py-2 px-3 pb-safe">
        {[
          { id: "home", label: "Home", icon: HomeIcon, action: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
          { id: "menu", label: "Menu", icon: UtensilsCrossed, action: () => document.getElementById("menu-categories")?.scrollIntoView({ behavior: "smooth" }) },
          { id: "offers", label: "Offers", icon: Tag, action: () => setShowOffers(true) },
          { id: "locations", label: "Locations", icon: MapPin, action: () => setShowLocations(true) },
          { id: "profile", label: "Profile", icon: User, action: () => (window.location.href = "/rewards") },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeNav === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveNav(tab.id);
                tab.action();
              }}
              className="flex flex-col items-center justify-center py-1 px-2 relative"
            >
              <Icon
                size={18}
                className={isActive ? "text-[#7B4E35]" : "text-[#766B61]"}
              />
              <span
                className={`text-[10px] mt-0.5 ${
                  isActive ? "font-bold text-[#7B4E35]" : "text-[#766B61]"
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-[#7B4E35] mt-0.5" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Floating Order Placed Notification */}
      <AnimatePresence>
        {orderPlaced && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl bg-[#29231F] text-white shadow-2xl flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Check size={16} />
            </div>
            <div>
              <p className="font-serif font-bold text-sm">Order sent to kitchen!</p>
              <p className="text-[11px] text-stone-300">Your table order is being prepared.</p>
            </div>
            {tableNumber && (
              <button
                onClick={() => (window.location.href = `/current-order?table=${tableNumber}`)}
                className="ml-2 px-3 py-1.5 rounded-full bg-[#7B4E35] text-white text-xs font-semibold hover:bg-[#633D28]"
              >
                Track
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper icon
function BookOpenIcon(props: any) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
