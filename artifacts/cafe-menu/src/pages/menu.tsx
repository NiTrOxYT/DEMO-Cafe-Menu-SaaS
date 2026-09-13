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
  Percent,
  MapPin,
  User,
  Crown,
  MessageCircle,
  Clock,
  Check,
  Croissant,
  Soup,
  Utensils,
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

// High quality photography matching the boutique cafe editorial reference
const DEFAULT_HERO_LATTE =
  "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=85";
const DEFAULT_SEASONAL_DISH =
  "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=700&q=85";

const FALLBACK_CATEGORY_IMAGES: Record<string, string> = {
  cappuccino:
    "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
  avocado:
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80",
  truffle:
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80",
  coffee:
    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80",
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

function getImageSrc(imageUrl: string | undefined | null, name?: string): string {
  if (imageUrl) {
    if (imageUrl.startsWith("/objects/")) return `/api/storage${imageUrl}`;
    return imageUrl;
  }
  if (name) {
    const key = name.toLowerCase();
    for (const [k, v] of Object.entries(FALLBACK_CATEGORY_IMAGES)) {
      if (key.includes(k)) return v;
    }
  }
  return "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80";
}

// --- Botanical Leaf SVG Decoration ---
function BotanicalLeaf({ className = "w-6 h-6", color = "#29231F" }: { className?: string; color?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={color}
      className={className}
    >
      <path d="M17.5 2C15 2 10.5 4.5 9 8.5C7.8 11.7 8.3 15.2 7 18C6.3 19.5 5 21 3 22C6.5 22 10 20 12.5 17C15.5 13.5 18 8 18.5 4.5C18.8 3.2 18.5 2.4 17.5 2ZM11.5 14C11.5 14 13.5 10 16 7" />
    </svg>
  );
}

// --- Category Icon Helper (Exact Match to Reference Mockup) ---
function getCategoryIcon(name: string, size = 18) {
  const n = name.toLowerCase();
  if (n.includes("coffee") || n === "all") return <Coffee size={size} />;
  if (n.includes("breakfast") || n.includes("bakery") || n.includes("croissant")) return <Croissant size={size} />;
  if (n.includes("starter") || n.includes("snack") || n.includes("salad")) return <Leaf size={size} />;
  if (n.includes("main") || n.includes("meal") || n.includes("dish")) return <Soup size={size} />;
  if (n.includes("dessert") || n.includes("cake") || n.includes("sweet")) return <Cake size={size} />;
  if (n.includes("beverage") || n.includes("drink") || n.includes("cooler")) return <CupSoda size={size} />;
  return <Utensils size={size} />;
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

// ==========================================
// FOOD CARD (Exact Match to Reference Design)
// ==========================================
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
  const imgSrc = getImageSrc(item.imageUrl, item.name);

  // Auto assign badges if not specified
  let badgeLabel = item.badge;
  if (!badgeLabel) {
    if (item.name.toLowerCase().includes("cappuccino") || item.isBestseller) {
      badgeLabel = "BESTSELLER";
    } else if (item.name.toLowerCase().includes("avocado") || item.name.toLowerCase().includes("toast")) {
      badgeLabel = "CHEF'S PICK";
    } else if (item.name.toLowerCase().includes("truffle") || item.name.toLowerCase().includes("cake")) {
      badgeLabel = "NEW";
    }
  }

  return (
    <div
      onClick={onClick}
      className="group flex flex-col bg-[#FFFDF9] rounded-2xl border border-[#E5DDD1] overflow-hidden shadow-[0_2px_10px_rgba(41,35,31,0.03)] hover:shadow-[0_8px_20px_rgba(41,35,31,0.07)] transition-all duration-300 cursor-pointer min-w-0"
    >
      {/* Top Image Container */}
      <div className="relative aspect-[1/0.88] w-full overflow-hidden bg-[#EFE7DA]">
        <img
          src={imgSrc}
          alt={item.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
        />

        {/* Badge (Top Left) */}
        {badgeLabel && (
          <div className="absolute top-2 left-2 z-10">
            {badgeLabel === "BESTSELLER" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-[#E8BA60] text-[#29231F] shadow-xs">
                ★ BESTSELLER
              </span>
            )}
            {badgeLabel === "CHEF'S PICK" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-[#DFBA79] text-[#29231F] shadow-xs">
                ♛ CHEF'S PICK
              </span>
            )}
            {badgeLabel === "NEW" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-[#A7B89B] text-[#1E2819] shadow-xs">
                🌿 NEW
              </span>
            )}
          </div>
        )}

        {/* Favorite Heart (Top Right) */}
        <button
          type="button"
          onClick={onToggleFavorite}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/20 backdrop-blur-xs flex items-center justify-center text-white hover:text-[#D84040] transition-colors z-10"
          aria-label="Favorite"
        >
          <Heart size={14} fill={isFavorite ? "#D84040" : "none"} strokeWidth={2} />
        </button>

        {!item.available && (
          <div className="absolute inset-0 bg-[#F8F5EF]/85 backdrop-blur-xs flex items-center justify-center z-10">
            <span className="text-[10px] uppercase font-semibold text-[#766B61] bg-white px-2.5 py-1 rounded-full border border-[#E5DDD1]">
              Sold Out
            </span>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between gap-1.5">
        <div>
          <h3 className="font-serif font-bold text-[15px] sm:text-[16px] text-[#29231F] leading-snug truncate">
            {item.name}
          </h3>

          {item.description && (
            <p className="text-[11px] sm:text-[12px] text-[#766B61] line-clamp-2 leading-tight font-sans mt-0.5">
              {item.description}
            </p>
          )}
        </div>

        {/* Price & Circular Add Button */}
        <div className="flex items-center justify-between pt-1 mt-auto">
          <span className="font-sans font-extrabold text-[15px] sm:text-[16px] text-[#29231F]">
            {formatINR(item.price)}
          </span>

          <div onClick={(e) => e.stopPropagation()}>
            {item.available && (
              cartQty === 0 ? (
                <button
                  type="button"
                  onClick={onAdd}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#7B4E35] text-white flex items-center justify-center hover:bg-[#633D28] transition-all active:scale-95 shadow-xs"
                  aria-label={`Add ${item.name}`}
                >
                  <Plus size={15} />
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-[#EFE7DA] border border-[#D8CEBF] rounded-full px-1.5 py-0.5 shadow-xs">
                  <button
                    type="button"
                    onClick={onRemove}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[#7B4E35]"
                  >
                    <Minus size={11} />
                  </button>
                  <span className="text-xs font-bold text-[#29231F] min-w-3 text-center">
                    {cartQty}
                  </span>
                  <button
                    type="button"
                    onClick={onAdd}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[#7B4E35]"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN CUSTOMER-FACING QR MENU COMPONENT
// ==========================================
export default function MenuPage() {
  const { data: menuItems = [] } = useListMenuItems(undefined);
  const { data: categories = [] } = useListCategories();
  const { data: settings } = useGetSettings();

  const tableNumber = new URLSearchParams(window.location.search).get("table");

  const restaurantName = settings?.restaurantName ?? "The Golden Brew";
  const tagline = settings?.tagline ?? "Fresh ingredients. Thoughtful recipes. A better you, every day.";
  const whatsappNumber = settings?.whatsappNumber ?? null;

  const cart = useCart();

  // State
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [vegFilter, setVegFilter] = useState<"all" | "veg" | "nonveg">("all");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [activeNav, setActiveNav] = useState<"home" | "menu" | "offers" | "locations" | "profile">("home");

  // Sub-Modals
  const [showOffers, setShowOffers] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
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
  const bestsellers = (menuItems as MenuItem[]).filter((i) => i.available);

  // Category pill list including static mock fallback matching reference image
  const displayCategories = [
    { id: null, name: "All", icon: "all" },
    ...(sortedCategories.length > 0
      ? sortedCategories.map((c) => ({ id: c.id, name: c.name, icon: c.name.toLowerCase() }))
      : [
          { id: 1, name: "Coffee", icon: "coffee" },
          { id: 2, name: "Breakfast", icon: "breakfast" },
          { id: 3, name: "Starters", icon: "starters" },
          { id: 4, name: "Main Course", icon: "main" },
          { id: 5, name: "Desserts", icon: "desserts" },
          { id: 6, name: "Beverages", icon: "beverages" },
        ]),
  ];

  return (
    <div className="min-h-screen bg-[#F8F5EF] text-[#29231F] font-sans antialiased selection:bg-[#EFE7DA] selection:text-[#7B4E35] pb-24">
      {/* ==================================================== */}
      {/* 1. TOP HEADER (Exact Match to Reference Mockup)       */}
      {/* ==================================================== */}
      <header className="sticky top-0 z-40 bg-[#F8F5EF]/95 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-[#E5DDD1]">
        {/* Left Café Logo */}
        <div className="flex items-center gap-2.5">
          <BotanicalLeaf className="w-6 h-6 text-[#29231F]" />
          <div>
            <h1 className="font-serif text-[17px] sm:text-[19px] font-bold text-[#29231F] leading-tight tracking-tight">
              {restaurantName}
            </h1>
            <p className="text-[8px] uppercase tracking-[0.24em] text-[#766B61] font-semibold">
              CAFÉ & KITCHEN
            </p>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2.5">
          {/* Search Toggle */}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="w-10 h-10 rounded-full bg-[#FFFDF9] border border-[#E5DDD1] flex items-center justify-center text-[#29231F] shadow-2xs hover:bg-[#EFE7DA] transition-colors"
            aria-label="Search food and drinks"
          >
            <Search size={16} />
          </button>

          {/* Cart Button with Count Badge */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative w-10 h-10 rounded-xl bg-[#FFFDF9] border border-[#E5DDD1] flex items-center justify-center text-[#29231F] shadow-2xs hover:bg-[#EFE7DA] transition-colors"
            aria-label="Shopping Cart"
          >
            <ShoppingBag size={17} />
            {cart.count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-[#7B4E35] text-white text-[10px] font-bold flex items-center justify-center">
                {cart.count}
              </span>
            )}
          </button>

          {/* Hamburger Menu Icon */}
          <button
            onClick={() => setShowOffers(true)}
            className="w-10 h-10 rounded-full bg-[#FFFDF9] border border-[#E5DDD1] flex items-center justify-center text-[#29231F] shadow-2xs hover:bg-[#EFE7DA] transition-colors"
            aria-label="Menu Information"
          >
            <MenuIcon size={17} />
          </button>
        </div>
      </header>

      {/* Expandable Search Input Bar */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-4 py-2.5 bg-[#FFFDF9] border-b border-[#E5DDD1]"
          >
            <div className="relative max-w-md mx-auto">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#766B61]" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search food, coffee, desserts..."
                className="w-full pl-9 pr-9 py-2 rounded-full bg-[#F8F5EF] border border-[#E5DDD1] text-xs outline-none focus:border-[#7B4E35]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#766B61]"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6 pt-3 space-y-4 sm:space-y-5">
        {/* ==================================================== */}
        {/* 2. HERO SECTION (Editorial Large Café Photograph)    */}
        {/* ==================================================== */}
        <section className="relative overflow-hidden pt-1 pb-1">
          {/* Subtle Decorative Botanical Leaf in Background */}
          <div className="absolute -top-1 -right-2 w-32 h-32 opacity-25 pointer-events-none text-[#737D63]">
            <BotanicalLeaf className="w-full h-full" color="#737D63" />
          </div>
          <div className="absolute bottom-2 -left-4 w-20 h-20 opacity-15 pointer-events-none text-[#A86E4D] -rotate-45">
            <BotanicalLeaf className="w-full h-full" color="#A86E4D" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-center">
            {/* Left Copy */}
            <div className="md:col-span-7 space-y-2.5 z-10">
              <p className="text-[10px] uppercase tracking-[0.24em] font-bold text-[#766B61]">
                GOOD FOOD • GOOD PEOPLE
              </p>

              <h2 className="font-serif text-[32px] sm:text-[40px] lg:text-[46px] font-bold text-[#29231F] leading-[1.05] tracking-tight">
                More Than <br />
                Just a Meal
              </h2>

              <p className="text-[12px] sm:text-[13px] text-[#766B61] leading-relaxed max-w-sm font-sans">
                {tagline}
              </p>

              <div className="pt-1 flex flex-wrap items-center gap-3.5">
                <button
                  onClick={() => {
                    document.getElementById("category-scroller")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-5 py-2.5 rounded-full bg-[#7B4E35] text-white font-medium text-xs inline-flex items-center gap-2 hover:bg-[#633D28] transition-all transform active:scale-95 shadow-sm"
                >
                  <span>Explore Menu</span>
                  <ArrowRight size={14} />
                </button>

                {/* Handwritten Script (Bottom Left) */}
                <div className="font-script text-[18px] sm:text-[20px] text-[#7B4E35] -rotate-2 select-none">
                  —— Food Tastes Better Together
                </div>
              </div>
            </div>

            {/* Right/Bottom Large Integrated Editorial Café Photograph */}
            <div className="md:col-span-5 relative mt-2 md:mt-0">
              {/* Handwritten Script (Top Right / Above Image) */}
              <div className="flex justify-end pr-3 -mb-2 relative z-10">
                <span className="font-script text-[20px] sm:text-[23px] text-[#7B4E35] -rotate-6 select-none leading-none">
                  Good Food Good Mood
                </span>
              </div>

              {/* Large Integrated Editorial Photo (Aspect Ratio ~4/3, Full Width with Side Margins) */}
              <div className="relative w-full h-[230px] sm:h-[260px] md:h-[340px] rounded-[22px] overflow-hidden border border-[#E5DDD1] shadow-[0_6px_24px_rgba(41,35,31,0.05)] bg-[#EFE7DA]">
                <img
                  src={DEFAULT_HERO_LATTE}
                  alt="Artisan ceramic coffee cup and pastry in morning light at boutique cafe"
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-[1.02]"
                />
                {/* Subtle warm overlay for background blending */}
                <div className="absolute inset-0 bg-[#F8F5EF]/[0.05] pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#29231F]/15 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>
          </div>
        </section>

        {/* Search Input Bar */}
        <div className="relative w-full pt-1">
          <Search
            size={15}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#766B61]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search food, coffee, desserts..."
            className="w-full pl-10 pr-9 py-2.5 sm:py-3 rounded-full bg-[#FFFDF9] border border-[#E5DDD1] text-xs sm:text-sm text-[#29231F] placeholder:text-[#766B61]/70 focus:outline-none focus:border-[#7B4E35] shadow-2xs"
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

        {/* ==================================================== */}
        {/* 3. CATEGORY SCROLLER (Exact Match to Reference)      */}
        {/* ==================================================== */}
        <section id="category-scroller" className="space-y-2">
          <div
            ref={categoryBarRef}
            className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none"
          >
            {displayCategories.map((cat, idx) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.name + idx}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex flex-col items-center justify-center min-w-[72px] sm:min-w-[80px] h-[74px] sm:h-[80px] rounded-2xl p-2 transition-all flex-shrink-0 ${
                    isSelected
                      ? "bg-[#7B4E35] text-white shadow-sm"
                      : "bg-[#FFFDF9] text-[#29231F] border border-[#E5DDD1] hover:bg-[#EFE7DA]"
                  }`}
                >
                  <div className="mb-1.5 opacity-90">
                    {getCategoryIcon(cat.name, 19)}
                  </div>
                  <span className="text-[11px] sm:text-[12px] font-semibold tracking-tight">
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Dietary Filter Buttons (Veg / Non-Veg) */}
          <div className="flex items-center gap-2 pt-1">
            {[
              { id: "all", label: "All" },
              { id: "veg", label: "Veg", icon: Leaf },
              { id: "nonveg", label: "Non-Veg", icon: Flame },
            ].map((f) => {
              const isSelected = vegFilter === f.id;
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => setVegFilter(f.id as any)}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-[#29231F] text-white"
                      : "bg-[#FFFDF9] text-[#766B61] border border-[#E5DDD1] hover:bg-[#EFE7DA]"
                  }`}
                >
                  {Icon && <Icon size={11} />}
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ==================================================== */}
        {/* 4. CHEF'S PICKS (Exact 2-3 Column Grid / Cards)     */}
        {/* ==================================================== */}
        <section className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-[22px] sm:text-[26px] font-bold text-[#29231F]">
              Chef's Picks
            </h2>
            <button
              onClick={() => setSelectedCategory(null)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#7B4E35] hover:underline"
            >
              <span>View All</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {filtered.slice(0, 6).map((item) => (
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

        {/* ==================================================== */}
        {/* 5. SEASONAL SPECIALS BANNER (Exact Match)            */}
        {/* ==================================================== */}
        {selectedCategory === null && !searchQuery && (
          <section className="relative overflow-hidden rounded-2xl bg-[#2A3828] text-white p-5 sm:p-6 shadow-md my-2">
            <div className="relative z-10 grid grid-cols-12 gap-3 items-center">
              <div className="col-span-7 space-y-1.5">
                <h3 className="font-serif text-[20px] sm:text-[24px] font-bold text-white leading-tight">
                  Seasonal Specials
                </h3>
                <p className="text-[9px] uppercase tracking-[0.2em] text-[#D0DEC8] font-bold">
                  HANDPICKED FLAVOURS FOR A LIMITED TIME
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      const dessert = categories.find((c) => c.name.toLowerCase().includes("dessert"));
                      if (dessert) setSelectedCategory(dessert.id);
                    }}
                    className="px-4 py-2 rounded-full bg-[#F8F5EF] text-[#29231F] font-semibold text-[11px] hover:bg-[#EFE7DA] transition-colors inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <span>Discover Now</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>

              <div className="col-span-5 relative flex items-center justify-end">
                {/* Handwritten script */}
                <div className="absolute -top-3.5 right-0 font-script text-[17px] sm:text-[20px] text-[#E5F0DF] -rotate-3 select-none">
                  Fresh Seasonal Local
                </div>
                <img
                  src={DEFAULT_SEASONAL_DISH}
                  alt="Seasonal Bowl Special"
                  className="w-24 sm:w-32 h-24 sm:h-32 object-cover rounded-full border border-white/30 shadow-lg"
                />
              </div>
            </div>
          </section>
        )}

        {/* Additional Category Section if selected or full list */}
        {selectedCategory !== null && (
          <section className="space-y-3 pt-2">
            <h2 className="font-serif text-[20px] font-bold text-[#29231F]">
              {categories.find((c) => c.id === selectedCategory)?.name ?? "Items"}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
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
          </section>
        )}
      </div>

      {/* ==================================================== */}
      {/* 6. FIXED BOTTOM NAVIGATION BAR (Exact Match)         */}
      {/* ==================================================== */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#FFFDF9]/95 backdrop-blur-md border-t border-[#E5DDD1] flex items-center justify-around py-2.5 px-3 pb-safe">
        {[
          { id: "home", label: "Home", icon: HomeIcon, action: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
          { id: "menu", label: "Menu", icon: Utensils, action: () => document.getElementById("category-scroller")?.scrollIntoView({ behavior: "smooth" }) },
          { id: "offers", label: "Offers", icon: Percent, action: () => setShowOffers(true) },
          { id: "locations", label: "Locations", icon: MapPin, action: () => setShowLocations(true) },
          { id: "profile", label: "Profile", icon: User, action: () => (window.location.href = "/rewards") },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeNav === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveNav(tab.id as any);
                tab.action();
              }}
              className="flex flex-col items-center justify-center py-0.5 px-2 relative"
            >
              <Icon
                size={19}
                className={isActive ? "text-[#7B4E35]" : "text-[#766B61]"}
                strokeWidth={isActive ? 2.2 : 1.8}
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

      {/* Floating Active Order Quick Bar */}
      {cart.count > 0 && !cartOpen && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-16 left-4 right-4 z-40 max-w-md mx-auto"
        >
          <div
            onClick={() => setCartOpen(true)}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-[#29231F] text-white shadow-xl cursor-pointer hover:bg-[#1E150F] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#7B4E35] flex items-center justify-center text-white text-xs font-bold">
                {cart.count}
              </div>
              <div>
                <p className="text-xs font-bold">View Current Order</p>
                <p className="text-[10px] text-stone-300">Tap to review & checkout</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-sm">{formatINR(cart.total)}</span>
              <ArrowRight size={14} className="text-[#D4A84D]" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Cart Drawer */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs"
          onClick={() => setCartOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#FFFDF9] h-full flex flex-col p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#E5DDD1]">
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#29231F]">Your Order</h2>
                {tableNumber && <p className="text-xs text-[#766B61]">Table {tableNumber}</p>}
              </div>
              <button onClick={() => setCartOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {cart.items.length === 0 ? (
                <div className="text-center py-20 text-[#766B61]">
                  <ShoppingBag size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Your order is empty</p>
                </div>
              ) : (
                cart.items.map((i) => (
                  <div key={i.id} className="flex justify-between items-center p-3 rounded-xl bg-[#F8F5EF] border border-[#E5DDD1]">
                    <div>
                      <p className="font-serif font-bold text-sm text-[#29231F]">{i.name}</p>
                      <p className="text-xs text-[#7B4E35]">{formatINR(i.price)}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-full px-2 py-1 border border-[#E5DDD1]">
                      <button onClick={() => cart.remove(i.id)} className="text-[#7B4E35]"><Minus size={11} /></button>
                      <span className="text-xs font-bold">{i.quantity}</span>
                      <button onClick={() => cart.add({ id: i.id, name: i.name, price: i.price } as any)} className="text-[#7B4E35]"><Plus size={11} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.items.length > 0 && (
              <div className="pt-4 border-t border-[#E5DDD1] space-y-3">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatINR(cart.total)}</span>
                </div>
                <button
                  onClick={handlePlaceOrder}
                  className="w-full py-3.5 rounded-full bg-[#7B4E35] text-white font-medium text-sm hover:bg-[#633D28]"
                >
                  Confirm & Place Order
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Item Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="w-full max-w-sm bg-[#FFFDF9] rounded-3xl border border-[#E5DDD1] overflow-hidden shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-[#EFE7DA]">
              <img src={getImageSrc(selectedItem.imageUrl, selectedItem.name)} alt={selectedItem.name} className="w-full h-full object-cover" />
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/30 text-white flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>
            <div>
              <h3 className="font-serif text-2xl font-bold text-[#29231F]">{selectedItem.name}</h3>
              <p className="text-xs text-[#766B61] mt-1">{selectedItem.description}</p>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-[#E5DDD1]">
              <span className="font-extrabold text-xl">{formatINR(selectedItem.price)}</span>
              <button
                onClick={() => {
                  cart.add(selectedItem);
                  setSelectedItem(null);
                }}
                className="px-5 py-2.5 rounded-full bg-[#7B4E35] text-white text-xs font-semibold"
              >
                Add to Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
