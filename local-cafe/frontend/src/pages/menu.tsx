import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import {
  createOrder,
  getOrder,
  getTableSession,
  createTableSession,
  joinTableSession,
  getSessionOrders,
  cancelOrder,
  getOffers,
  evaluateOffers,
  TableSession,
  Order,
  Offer,
} from "@/lib/api";
import {
  useListMenuItems,
  useListCategories,
  useGetSettings,
  useCreateOrder,
} from "@/lib/api";
import {
  joinOrderRoom,
  joinSessionRoom,
  leaveSessionRoom,
  onOrderStatusChanged,
  onOrderUpdated,
  onOrderCreated,
  onSessionFinished,
  onSessionUpdated,
  onSocketConnect,
} from "@/lib/socket";
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
  CheckCircle,
  Croissant,
  Soup,
  Utensils,
  Receipt,
  Printer,
  Download,
  CreditCard,
  Tag,
  AlertCircle,
  RefreshCw,
  Users,
  QrCode,
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
  let url = imageUrl;
  if (!url && name) {
    const key = name.toLowerCase();
    for (const [k, v] of Object.entries(FALLBACK_CATEGORY_IMAGES)) {
      if (key.includes(k)) {
        url = v;
        break;
      }
    }
  }
  if (!url) {
    url = "https://images.unsplash.com/photo-1509042239860-f550ce710b93";
  }
  if (url.startsWith("/objects/")) return `/api/storage${url}`;
  if (url.includes("images.unsplash.com")) {
    const base = url.split("?")[0];
    return `${base}?auto=format&fit=crop&w=420&q=75`;
  }
  return url;
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
// FOOD CARD (Optimized & Memoized)
// ==========================================
const FoodCard = memo(function FoodCard({
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
      className="group flex flex-col bg-[#FFFDF9] rounded-2xl border border-[#E5DDD1] overflow-hidden shadow-[0_2px_8px_rgba(41,35,31,0.03)] hover:shadow-[0_6px_16px_rgba(41,35,31,0.06)] cursor-pointer min-w-0 card-smooth-press"
    >
      {/* Top Image Container */}
      <div className="relative aspect-[1/0.88] w-full overflow-hidden bg-[#EFE7DA]">
        <img
          src={imgSrc}
          alt={item.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300 ease-out"
        />

        {/* Badge (Top Left) */}
        {badgeLabel && (
          <div className="absolute top-2 left-2 z-10 pointer-events-none">
            {badgeLabel === "BESTSELLER" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-[#E8BA60] text-[#29231F] shadow-2xs">
                ★ BESTSELLER
              </span>
            )}
            {badgeLabel === "CHEF'S PICK" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-[#DFBA79] text-[#29231F] shadow-2xs">
                ♛ CHEF'S PICK
              </span>
            )}
            {badgeLabel === "NEW" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-[#A7B89B] text-[#1E2819] shadow-2xs">
                🌿 NEW
              </span>
            )}
          </div>
        )}

        {/* Favorite Heart (Top Right) */}
        <button
          type="button"
          onClick={onToggleFavorite}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/25 backdrop-blur-xs flex items-center justify-center text-white hover:text-[#D84040] transition-colors z-10 btn-smooth-press-sm"
          aria-label="Favorite"
        >
          <Heart size={14} fill={isFavorite ? "#D84040" : "none"} strokeWidth={2} />
        </button>

        {!item.available && (
          <div className="absolute inset-0 bg-[#F8F5EF]/85 backdrop-blur-xs flex items-center justify-center z-10 pointer-events-none">
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
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#7B4E35] text-white flex items-center justify-center hover:bg-[#633D28] transition-colors shadow-2xs btn-smooth-press"
                  aria-label={`Add ${item.name}`}
                >
                  <Plus size={15} />
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-[#EFE7DA] border border-[#D8CEBF] rounded-full px-1.5 py-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={onRemove}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[#7B4E35] btn-smooth-press-sm"
                  >
                    <Minus size={11} />
                  </button>
                  <span className="text-xs font-bold text-[#29231F] min-w-3 text-center">
                    {cartQty}
                  </span>
                  <button
                    type="button"
                    onClick={onAdd}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[#7B4E35] btn-smooth-press-sm"
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
});

// ==========================================
// MAIN CUSTOMER-FACING QR MENU COMPONENT
// ==========================================
interface PendingCheckout {
  key: string;
  signature: string;
  createdAt: number;
}

function computeCheckoutSignature(
  tableNumber: string | number | undefined,
  items: any[],
  notes: string,
  offerId?: number | null
): string {
  const sortedItems = [...items]
    .map((i) => ({ id: i.id, qty: i.quantity, price: Number(i.price) }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return JSON.stringify({
    table: String(tableNumber || "1"),
    items: sortedItems,
    notes: notes.trim(),
    offerId: offerId || null,
  });
}

export default function MenuPage() {
  const {
    data: menuItems = [],
    isLoading: isMenuLoading,
    isError: isMenuError,
    refetch: refetchMenu,
  } = useListMenuItems(undefined);
  const {
    data: categories = [],
    isLoading: isCategoriesLoading,
    isError: isCategoriesError,
    refetch: refetchCategories,
  } = useListCategories();
  const { data: settings } = useGetSettings();

  const tableParam = useMemo(() => {
    if (typeof window === "undefined") return null;
    const t = new URLSearchParams(window.location.search).get("table");
    return t && t.trim() ? t.trim() : null;
  }, []);

  const hasTable = Boolean(tableParam);
  const tableNumber = tableParam || "";

  const restaurantName = settings?.restaurantName ?? "Kusum Kunja Café";
  const tagline = settings?.tagline ?? "Fresh ingredients. Thoughtful recipes. A better you, every day.";
  const whatsappNumber = settings?.whatsappNumber ?? null;

  const printReceipt = () => {
    const receipt = document.getElementById("receipt-print-root");
    if (!receipt) return;

    const printWindow = window.open("", "_blank", "width=480,height=800");
    if (!printWindow) {
      window.alert("Allow pop-ups for this site to print or save the receipt.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write("<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Café Receipt</title></head><body></body></html>");
    printWindow.document.close();

    const printDocument = printWindow.document;
    document.head.querySelectorAll('link[rel="stylesheet"], style').forEach((styleNode) => {
      printDocument.head.appendChild(styleNode.cloneNode(true));
    });

    const printStyles = printDocument.createElement("style");
    printStyles.textContent = `
      @page { margin: 8mm; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body { display: flex; justify-content: center; }
      #receipt-print-root {
        display: block !important;
        position: static !important;
        width: 100% !important;
        max-width: 78mm !important;
        max-height: none !important;
        height: auto !important;
        margin: 0 auto !important;
        overflow: visible !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        background: #fff !important;
        transform: none !important;
      }
      .receipt-print-actions { display: none !important; }
    `;
    printDocument.head.appendChild(printStyles);

    const printableReceipt = receipt.cloneNode(true) as HTMLElement;
    printableReceipt.querySelector(".receipt-print-actions")?.remove();
    printDocument.body.appendChild(printableReceipt);

    printWindow.onafterprint = () => printWindow.close();
    const printStylesheets = Array.from(
      printDocument.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    );
    Promise.all(
      printStylesheets.map(
        (link) =>
          new Promise<void>((resolve) => {
            if (link.sheet) {
              resolve();
              return;
            }
            link.addEventListener("load", () => resolve(), { once: true });
            link.addEventListener("error", () => resolve(), { once: true });
          }),
      ),
    ).then(async () => {
      await printDocument.fonts?.ready;
      window.setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 100);
    });
  };

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
  const [activeNav, setActiveNav] = useState<"home" | "menu" | "offers">("home");

  // Sub-Modals
  const [showOffers, setShowOffers] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [showActiveOrderModal, setShowActiveOrderModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [showNoTableModal, setShowNoTableModal] = useState(false);
  const [manualTableInput, setManualTableInput] = useState("");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeOrderData, setActiveOrderData] = useState<any>(null);

  // Table Session State
  const [sessionStatus, setSessionStatus] = useState<"loading" | "needs_party_size" | "active" | "full" | "finished" | "none">(
    hasTable ? "loading" : "none"
  );
  const [sessionData, setSessionData] = useState<TableSession | null>(null);
  const [sessionMember, setSessionMember] = useState<{ id: number; isFirstGuest: boolean; guestName?: string } | null>(null);
  const [sessionMembersCount, setSessionMembersCount] = useState<number>(1);
  const [sessionOrders, setSessionOrders] = useState<Order[]>([]);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);
  const [selectedPartySize, setSelectedPartySize] = useState<number>(2);
  const [isJoiningSession, setIsJoiningSession] = useState<boolean>(false);
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const isSubmittingOrderRef = useRef<boolean>(false);
  const pendingCheckoutRef = useRef<PendingCheckout | null>(null);

  // Restore any unresolved pending checkout from sessionStorage on mount / tableNumber change
  useEffect(() => {
    if (typeof window !== "undefined" && tableNumber) {
      try {
        const stored = sessionStorage.getItem(`pending_checkout_${tableNumber}`);
        if (stored) {
          pendingCheckoutRef.current = JSON.parse(stored);
        }
      } catch (e) {
        console.error("Failed to parse pending checkout from sessionStorage", e);
      }
    }
  }, [tableNumber]);

  const categoryBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname.toLowerCase();
      if (path.includes("offers")) {
        setShowOffers(true);
        setActiveNav("offers");
      } else if (path.includes("locations")) {
        setShowLocations(true);
        setActiveNav("locations");
      }
    }
  }, []);

  // Offers & Combos State (Automatic Evaluation)
  const [offersList, setOffersList] = useState<Offer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [appliedOffer, setAppliedOffer] = useState<{
    id?: number;
    title: string;
    discountAmount: number;
    offerType?: string;
  } | null>(null);
  const [evaluatingOffers, setEvaluatingOffers] = useState(false);

  const fetchOffers = useCallback(async () => {
    try {
      setOffersLoading(true);
      const data = await getOffers(false);
      setOffersList(data);
    } catch (e) {
      console.error("Failed to load offers", e);
    } finally {
      setOffersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  // Automatically recalculate eligible offer whenever cart items or subtotal change
  useEffect(() => {
    if (cart.items.length === 0 || cart.total <= 0) {
      setAppliedOffer(null);
      return;
    }

    let isMounted = true;
    setEvaluatingOffers(true);

    const cartItemsPayload = cart.items.map((i) => ({
      menuItemId: i.id,
      name: i.name,
      quantity: i.quantity,
      price: i.price,
    }));

    evaluateOffers(cart.total, cartItemsPayload)
      .then((res) => {
        if (!isMounted) return;
        if (res?.bestOffer && res.discountAmount > 0) {
          setAppliedOffer({
            id: res.bestOffer.id,
            title: res.bestOffer.title,
            discountAmount: res.discountAmount,
            offerType: res.bestOffer.offerType,
          });
        } else {
          setAppliedOffer(null);
        }
      })
      .catch((err) => {
        console.error("Failed to evaluate offers", err);
        if (isMounted) setAppliedOffer(null);
      })
      .finally(() => {
        if (isMounted) setEvaluatingOffers(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cart.items, cart.total]);

  const handleAddComboToCart = (offer: Offer) => {
    if (Array.isArray(offer.comboItems) && offer.comboItems.length > 0) {
      for (const ci of offer.comboItems) {
        const menuItem = menuItems.find((m) => m.id === ci.menuItemId) || {
          id: ci.menuItemId || 999000 + Math.floor(Math.random() * 1000),
          name: ci.name,
          price: offer.comboPrice ? Math.round(Number(offer.comboPrice) / offer.comboItems.length) : 100,
        };
        for (let q = 0; q < (ci.quantity || 1); q++) {
          cart.add(menuItem as any);
        }
      }
      setShowOffers(false);
      setCartOpen(true);
    }
  };

  const toggleFavorite = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }, []);

  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);

  const cartQtyMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of cart.items) {
      map.set(item.id, item.quantity);
    }
    return map;
  }, [cart.items]);

  const fetchSessionOrders = useCallback(async (sessionId: number, token?: string) => {
    const guestToken = token || localStorage.getItem(`table_guest_token_${tableNumber}`) || "";
    try {
      const orders = await getSessionOrders(sessionId, guestToken);
      setSessionOrders(orders);
      const active = orders.filter((o) => o.status !== "cancelled" && o.status !== "completed");
      if (active.length > 0) {
        setActiveOrderId(active[active.length - 1].id.toString());
        setActiveOrderData(active[active.length - 1]);
      } else if (orders.length > 0) {
        setActiveOrderId(orders[orders.length - 1].id.toString());
        setActiveOrderData(orders[orders.length - 1]);
      } else {
        setActiveOrderId(null);
        setActiveOrderData(null);
      }
    } catch (err) {
      console.error("Failed to load session orders", err);
    }
  }, [tableNumber]);

  const initSession = useCallback(async () => {
    if (!hasTable || !tableNumber) {
      setSessionStatus("none");
      return;
    }
    setSessionStatus("loading");
    const storedToken = localStorage.getItem(`table_guest_token_${tableNumber}`) || "";

    try {
      const res = await getTableSession(tableNumber, storedToken);

      // Case 1: No active session exists for this table -> first guest sets party size
      if (!res.active) {
        localStorage.removeItem(`table_guest_token_${tableNumber}`);
        setSessionData(null);
        setSessionMember(null);
        setSessionOrders([]);
        setSessionStatus("needs_party_size");
        return;
      }

      // Case 2: Active session exists and guest is already a member
      if (res.isMember && res.session) {
        setSessionData(res.session);
        setSessionMember(res.member || null);
        setSessionMembersCount(res.membersCount || 1);
        setSessionStatus("active");
        joinSessionRoom(res.session.id, storedToken);
        fetchSessionOrders(res.session.id, storedToken);
        return;
      }

      // Case 3: Active session exists, but current device doesn't have a valid member token yet
      if (res.session) {
        if (res.isFull) {
          setSessionData(res.session);
          setSessionMembersCount(res.membersCount || res.session.partySize);
          setSessionStatus("full");
          return;
        }

        // Join existing session without asking party size
        try {
          const joinRes = await joinTableSession(tableNumber, storedToken);
          localStorage.setItem(`table_guest_token_${tableNumber}`, joinRes.guestToken);
          setSessionData(joinRes.session);
          setSessionMember(joinRes.member);
          setSessionMembersCount(joinRes.membersCount);
          setSessionStatus("active");
          joinSessionRoom(joinRes.session.id, joinRes.guestToken);
          fetchSessionOrders(joinRes.session.id, joinRes.guestToken);
        } catch (joinErr: any) {
          if (joinErr?.message?.includes("full") || joinErr?.code === "SESSION_FULL") {
            setSessionData(res.session);
            setSessionStatus("full");
          } else {
            setSessionStatus("active");
          }
        }
      }
    } catch (err: any) {
      console.error("Failed to check table session", err);
      setSessionStatus("active");
    }
  }, [hasTable, tableNumber, fetchSessionOrders]);

  const handleConfirmPartySize = async (size?: number) => {
    const chosenSize = size ?? selectedPartySize;
    if (!chosenSize || chosenSize < 1 || chosenSize > 4 || isJoiningSession) return;
    try {
      setIsJoiningSession(true);
      setSessionStatus("loading");
      const createRes = await createTableSession(tableNumber, chosenSize);
      localStorage.setItem(`table_guest_token_${tableNumber}`, createRes.guestToken);
      setSessionData(createRes.session);
      setSessionMember(createRes.member);
      setSessionMembersCount(1);
      setSessionStatus("active");
      joinSessionRoom(createRes.session.id, createRes.guestToken);
      fetchSessionOrders(createRes.session.id, createRes.guestToken);
    } catch (err: any) {
      // If session was created concurrently, re-init to join it
      initSession();
    } finally {
      setIsJoiningSession(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!window.confirm("Are you sure you want to cancel your order?")) return;
    try {
      setCancellingOrderId(orderId);
      const guestToken = localStorage.getItem(`table_guest_token_${tableNumber}`) || "";
      await cancelOrder(orderId, guestToken);
      if (sessionData?.id) {
        fetchSessionOrders(sessionData.id, guestToken);
      }
    } catch (err: any) {
      alert(err.message || "Failed to cancel order");
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handlePlaceOrder = async () => {
    if (!hasTable || !tableNumber) {
      setShowNoTableModal(true);
      return;
    }

    // Synchronous submit lock blocks accidental double-taps immediately
    if (isSubmittingOrderRef.current || cart.items.length === 0) return;
    isSubmittingOrderRef.current = true;
    setIsPlacingOrder(true);

    try {
      const guestToken = localStorage.getItem(`table_guest_token_${tableNumber}`) || "";
      const currentSignature = computeCheckoutSignature(
        tableNumber,
        cart.items,
        orderNotes,
        appliedOffer?.id
      );

      // Check if there is an unresolved pending checkout for the exact same payload
      let idempotencyKey: string;
      const pending = pendingCheckoutRef.current;

      if (pending && pending.signature === currentSignature) {
        // Retry of unresolved checkout attempt: reuse the exact same submission key
        idempotencyKey = pending.key;
      } else {
        // New checkout submission or cart modified: generate fresh key
        idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const newPending: PendingCheckout = {
          key: idempotencyKey,
          signature: currentSignature,
          createdAt: Date.now(),
        };
        pendingCheckoutRef.current = newPending;
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem(`pending_checkout_${tableNumber}`, JSON.stringify(newPending));
          } catch (e) {}
        }
      }

      const calculatedFinalTotal = Math.max(0, Math.round((cart.total - (appliedOffer?.discountAmount || 0)) * 100) / 100);

      // Every separate Place Order submission creates a new, independent order
      const order = await createOrder({
        tableNumber: tableNumber || 1,
        tableId: Number(tableNumber || 1),
        items: cart.items.map((item) => ({
          menuItemId: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        notes: orderNotes.trim() || undefined,
        subtotal: cart.total,
        discount: appliedOffer?.discountAmount || 0,
        offerId: appliedOffer?.id || undefined,
        tax: 0,
        total: calculatedFinalTotal,
      }, guestToken, idempotencyKey);

      // Confirmed success: clear pending attempt so subsequent orders receive a new key
      pendingCheckoutRef.current = null;
      if (typeof window !== "undefined") {
        try {
          sessionStorage.removeItem(`pending_checkout_${tableNumber}`);
        } catch (e) {}
      }

      if (order?.orderAccessToken) {
        localStorage.setItem(`orderAccessToken_${order.id}`, order.orderAccessToken);
        joinOrderRoom(order.id, order.orderAccessToken);
      }
      localStorage.setItem(`activeOrderId_${tableNumber}`, order.id.toString());
      localStorage.setItem("lastKnownOrderId", order.id.toString());
      setActiveOrderId(order.id.toString());
      setActiveOrderData(order);

      if (sessionData?.id) {
        fetchSessionOrders(sessionData.id, guestToken);
      }

      cart.clear();
      setAppliedOffer(null);
      setCartOpen(false);
      setOrderNotes("");
      setOrderPlaced(true);
      setTimeout(() => setOrderPlaced(false), 4000);
    } catch (err: any) {
      console.error(err);
      // Retain pendingCheckoutRef and sessionStorage intact on error/lost response for retry
      alert(err.message || "Failed to place order. Please try again.");
    } finally {
      // Synchronous submit lock resets in finally to allow retrying or new submissions
      isSubmittingOrderRef.current = false;
      setIsPlacingOrder(false);
    }
  };

  useEffect(() => {
    if (!hasTable || !tableNumber) {
      setSessionStatus("none");
      return;
    }

    initSession();

    // Listen for session finished by admin
    const unsubSessionFinished = onSessionFinished(({ sessionId, tableNumber: finishedTable }) => {
      if ((sessionData && sessionData.id === sessionId) || tableNumber === finishedTable) {
        setSessionStatus("finished");
        localStorage.removeItem(`table_guest_token_${tableNumber}`);
        localStorage.removeItem(`activeOrderId_${tableNumber}`);
        setActiveOrderId(null);
        setActiveOrderData(null);
        setSessionOrders([]);
      }
    });

    // Listen for member count updates
    const unsubSessionUpdated = onSessionUpdated((updatedSession) => {
      if (sessionData && sessionData.id === updatedSession.id) {
        setSessionMembersCount(updatedSession.membersCount);
      }
    });

    // Realtime order creation
    const unsubOrderCreated = onOrderCreated((order) => {
      if (sessionData?.id && (order.session_id === sessionData.id || order.table_number === tableNumber)) {
        const guestToken = localStorage.getItem(`table_guest_token_${tableNumber}`) || "";
        fetchSessionOrders(sessionData.id, guestToken);
      }
    });

    // Realtime order update
    const unsubOrderUpdated = onOrderUpdated((order) => {
      if (sessionData?.id && (order.session_id === sessionData.id || order.table_number === tableNumber)) {
        const guestToken = localStorage.getItem(`table_guest_token_${tableNumber}`) || "";
        fetchSessionOrders(sessionData.id, guestToken);
      }
    });

    // Realtime order status change
    const unsubStatus = onOrderStatusChanged((payload) => {
      setSessionOrders((prev) =>
        prev.map((o) =>
          o.id === payload.id
            ? {
                ...o,
                status: payload.status as any,
                is_active: payload.is_active,
                is_paid: payload.is_paid,
              }
            : o
        )
      );
      if (sessionData?.id && (payload.session_id === sessionData.id || sessionOrders.some(o => o.id === payload.id))) {
        const guestToken = localStorage.getItem(`table_guest_token_${tableNumber}`) || "";
        fetchSessionOrders(sessionData.id, guestToken);
      }
    });

    const unsubConnect = onSocketConnect(() => {
      const guestToken = localStorage.getItem(`table_guest_token_${tableNumber}`) || "";
      if (sessionData?.id && guestToken) {
        joinSessionRoom(sessionData.id, guestToken);
        fetchSessionOrders(sessionData.id, guestToken);
      }
    });

    const interval = setInterval(() => {
      if (sessionData?.id) {
        const guestToken = localStorage.getItem(`table_guest_token_${tableNumber}`) || "";
        fetchSessionOrders(sessionData.id, guestToken);
      }
    }, 20000);

    return () => {
      clearInterval(interval);
      unsubSessionFinished();
      unsubSessionUpdated();
      unsubOrderCreated();
      unsubOrderUpdated();
      unsubStatus();
      unsubConnect();
    };
  }, [hasTable, tableNumber, sessionData?.id, initSession, fetchSessionOrders]);

  const rawCategories = useMemo(() => {
    return Array.isArray(categories) ? categories : [];
  }, [categories]);

  const sortedCategories = useMemo(() => {
    return [...rawCategories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [rawCategories]);

  const validCategoryIds = useMemo(() => {
    return new Set(rawCategories.map((c) => c.id));
  }, [rawCategories]);

  const rawItems = useMemo(() => {
    if (!Array.isArray(menuItems)) return [];
    // Only items mapped to an active/valid category
    return (menuItems as MenuItem[]).filter((item) => validCategoryIds.has(item.categoryId));
  }, [menuItems, validCategoryIds]);

  // Filtered menu items
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rawItems.filter((item) => {
      if (!item.available) return false;
      if (selectedCategory !== null && item.categoryId !== selectedCategory)
        return false;
      if (vegFilter === "veg" && !item.isVeg) return false;
      if (vegFilter === "nonveg" && item.isVeg) return false;
      if (q) {
        return (
          item.name.toLowerCase().includes(q) ||
          (item.description ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rawItems, selectedCategory, vegFilter, searchQuery]);

  const bestsellers = useMemo(() => {
    return rawItems.filter((i) => i.available && (i.isBestseller || i.badge === "BESTSELLER" || i.badge === "CHEF'S PICK"));
  }, [rawItems]);

  // Group items by category for instant O(1) section rendering
  const categoryItemsMap = useMemo(() => {
    const map = new Map<number, MenuItem[]>();
    for (const item of filtered) {
      const list = map.get(item.categoryId) || [];
      list.push(item);
      map.set(item.categoryId, list);
    }
    return map;
  }, [filtered]);

  // Category pill list including static mock fallback matching reference image
  const displayCategories = useMemo(() => [
    { id: null, name: "All", icon: "all" },
    ...sortedCategories.map((c) => ({ id: c.id, name: c.name, icon: c.name.toLowerCase() })),
  ], [sortedCategories]);

  return (
    <div className="min-h-[100dvh] bg-[#F8F5EF] text-[#29231F] font-sans antialiased selection:bg-[#EFE7DA] selection:text-[#7B4E35] pb-[max(6.5rem,calc(5.5rem+env(safe-area-inset-bottom)))]">
      {/* ==================================================== */}
      {/* 1. TOP HEADER (Exact Match to Reference Mockup)       */}
      {/* ==================================================== */}
      <header className="sticky top-0 z-40 bg-[#F8F5EF]/95 backdrop-blur-md px-3 sm:px-6 pt-[max(0.625rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between border-b border-[#E5DDD1]">
        {/* Left Café Logo */}
        <div className="flex items-center gap-2.5">
          <img
            src="/kusum-kunja-cafe-logo.png"
            alt="Kusum Kunja Café logo"
            className="w-8 h-8 rounded-full object-cover border border-[#ECD7A9]"
          />
          <div>
            <h1 className="font-serif text-[17px] sm:text-[19px] font-bold text-[#29231F] leading-tight tracking-tight">
              {restaurantName}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[8px] uppercase tracking-[0.24em] text-[#766B61] font-semibold">
                CAFÉ & KITCHEN
              </span>
              {hasTable && tableNumber ? (
                <span className="text-[9px] font-bold text-[#7B4E35] bg-[#FAF3E6] border border-[#ECD7A9] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1">
                  <Users size={9} />
                  <span>T{tableNumber}</span>
                  {sessionData && (
                    <span>• {sessionMembersCount}/{sessionData.partySize} Guests</span>
                  )}
                </span>
              ) : (
                <span className="text-[9px] font-bold text-[#766B61] bg-[#FAF3E6] border border-[#ECD7A9] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <span>Digital Menu</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2.5">
          {/* Search Toggle */}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="w-10 h-10 rounded-full bg-[#FFFDF9] border border-[#E5DDD1] flex items-center justify-center text-[#29231F] shadow-2xs hover:bg-[#EFE7DA] btn-smooth-press"
            aria-label="Search food and drinks"
          >
            <Search size={16} />
          </button>

          {/* Cart Button with Count Badge */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative w-10 h-10 rounded-xl bg-[#FFFDF9] border border-[#E5DDD1] flex items-center justify-center text-[#29231F] shadow-2xs hover:bg-[#EFE7DA] btn-smooth-press"
            aria-label="Shopping Cart"
          >
            <ShoppingBag size={17} />
            {cart.count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-[#7B4E35] text-white text-[10px] font-bold flex items-center justify-center">
                {cart.count}
              </span>
            )}
          </button>

          {/* Current Order Button */}
          <button
            onClick={() => {
              if (activeOrderId || (cart.items.length === 0 && !activeOrderId)) {
                setShowActiveOrderModal(true);
              } else {
                setCartOpen(true);
              }
            }}
            className="relative px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#E5DDD1] flex items-center gap-1.5 text-[#29231F] shadow-2xs hover:bg-[#EFE7DA] text-xs font-semibold btn-smooth-press"
            aria-label="Current Order"
          >
            <Clock size={15} className="text-[#7B4E35]" />
            <span className="text-[11px] font-semibold text-[#29231F]">Order</span>
            {activeOrderId && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
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
            transition={{ duration: 0.15 }}
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#766B61] btn-smooth-press-sm"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto px-3 sm:px-6 pt-2.5 sm:pt-3 space-y-3.5 sm:space-y-5">
        {/* ==================================================== */}
        {/* 2. HERO BANNER SECTION (Exact Match to Reference)    */}
        {/* ==================================================== */}
        <section className="relative overflow-hidden rounded-[22px] md:rounded-[28px] border border-[#DED4C7] bg-[#F7F3EB] shadow-[0_4px_20px_rgba(70,48,34,0.05)] min-h-[300px] sm:min-h-[340px] md:min-h-[380px] flex items-center">
          {/* Background Banner Image from public/banner.png */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <img
              src="/banner.png"
              alt="Kusum Kunja Café Banner"
              loading="eager"
              decoding="async"
              className="w-full h-full object-cover object-right sm:object-center"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/hero-cafe-banner.jpg";
              }}
            />
            {/* Subtle soft gradient fade on left for maximum text contrast and readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#F8F5EF]/95 via-[#F8F5EF]/70 to-transparent sm:via-[#F8F5EF]/50 sm:to-transparent" />
          </div>

          {/* Foreground Hero Content (Left Aligned - High Contrast) */}
          <div className="relative z-10 px-5 sm:px-8 py-5 sm:py-7 max-w-[250px] sm:max-w-[340px] md:max-w-[440px] space-y-2.5 sm:space-y-3.5">
            {/* Tagline */}
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.26em] font-extrabold text-[#524135]">
              GOOD FOOD • GOOD PEOPLE
            </p>

            {/* Main Heading */}
            <h2 className="font-serif text-[30px] sm:text-[40px] md:text-[48px] font-bold text-[#191410] leading-[1.02] tracking-tight">
              More Than <br />
              Just a Meal
            </h2>

            {/* Subtitle */}
            <p className="text-[12px] sm:text-[13.5px] text-[#3D322A] font-medium leading-snug sm:leading-relaxed font-sans max-w-[220px] sm:max-w-xs">
              {tagline}
            </p>

            {/* Explore Menu Button */}
            <div className="pt-0.5">
              <button
                onClick={() => {
                  document.getElementById("category-scroller")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-[#54321E] text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-2 hover:bg-[#3D2314] shadow-sm btn-smooth-press"
              >
                <span>Explore Menu</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {/* Script below button */}
            <div className="pt-1 space-y-0.5">
              <div className="w-7 h-[2px] bg-[#6B4226]" />
              <p className="font-script text-[18px] sm:text-[22px] text-[#54321E] font-bold -rotate-2 select-none leading-snug">
                Food Tastes Better <br /> Together
              </p>
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
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#766B61] btn-smooth-press-sm"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* ==================================================== */}
        {/* 3. CATEGORY SCROLLER (Exact Match to Reference)      */}
        {/* ==================================================== */}
        {sortedCategories.length > 0 && (
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
                    className={`flex flex-col items-center justify-center min-w-[72px] sm:min-w-[80px] h-[74px] sm:h-[80px] rounded-2xl p-2 flex-shrink-0 btn-smooth-press ${isSelected
                        ? "bg-[#7B4E35] text-white shadow-xs"
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
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 btn-smooth-press ${isSelected
                        ? "bg-[#7B4E35] text-white shadow-2xs"
                        : "bg-[#FFFDF9] text-[#766B61] border border-[#E5DDD1] hover:bg-[#EFE7DA]"
                      }`}
                  >
                    {Icon && <Icon size={12} className={f.id === "veg" ? "text-emerald-600" : f.id === "nonveg" ? "text-rose-500" : ""} />}
                    <span>{f.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ==================================================== */}
        {/* 4. CHEF'S PICKS & FULL MENU CATEGORY SECTIONS        */}
        {/* ==================================================== */}

        {/* API ERROR STATE */}
        {(isMenuError || isCategoriesError) && (
          <div className="py-12 px-6 text-center bg-[#FFFDF9] rounded-2xl border border-rose-200 shadow-sm max-w-md mx-auto my-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-500">
              <AlertCircle size={22} />
            </div>
            <h3 className="font-serif text-lg font-bold text-[#29231F]">Unable to Load Menu</h3>
            <p className="text-xs text-[#766B61] leading-relaxed">
              We couldn't connect to the café server. Please verify your connection and tap retry.
            </p>
            <button
              onClick={() => {
                refetchMenu();
                refetchCategories();
              }}
              className="px-5 py-2.5 rounded-full bg-[#7B4E35] text-white text-xs font-semibold hover:bg-[#633E2B] transition-colors shadow-sm inline-flex items-center gap-1.5 btn-smooth-press"
            >
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* LOADING STATE */}
        {(isMenuLoading || isCategoriesLoading) && !(isMenuError || isCategoriesError) && (
          <div className="py-16 text-center text-[#766B61] space-y-3">
            <div className="w-10 h-10 rounded-full border-2 border-[#7B4E35] border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-medium uppercase tracking-wider text-[#766B61]">Loading Menu...</p>
          </div>
        )}

        {/* EMPTY MENU STATE */}
        {!isMenuLoading && !isCategoriesLoading && !isMenuError && !isCategoriesError && rawItems.length === 0 && (
          <div className="py-16 px-6 text-center bg-[#FFFDF9] rounded-2xl border border-[#E5DDD1] shadow-2xs max-w-md mx-auto my-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#FAF4E8] border border-[#E8E2D8] flex items-center justify-center mx-auto text-[#B58428]">
              <Coffee size={24} />
            </div>
            <h3 className="font-serif text-lg font-bold text-[#29231F]">No Menu Items Available Yet</h3>
            <p className="text-xs text-[#766B61] leading-relaxed">
              Our kitchen has not published any menu items yet. Please check back shortly or speak with our staff!
            </p>
          </div>
        )}

        {!isMenuLoading && !isCategoriesLoading && !isMenuError && !isCategoriesError && rawItems.length > 0 && (
          <>
        {/* SEARCH RESULTS VIEW (When search is active) */}
        {searchQuery.trim() !== "" && (
          <section className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-[22px] font-bold text-[#29231F]">
                Search Results ({filtered.length})
              </h2>
            </div>
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-[#766B61] bg-[#FFFDF9] rounded-2xl border border-[#E5DDD1] p-6">
                <p className="text-sm font-medium">No menu items found matching "{searchQuery}"</p>
                <p className="text-xs mt-1 text-[#766B61]/80">Try searching for cappuccino, toast, salad, or dessert</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {filtered.map((item) => (
                  <FoodCard
                    key={item.id}
                    item={item}
                    cartQty={cartQtyMap.get(item.id) ?? 0}
                    onAdd={() => cart.add(item)}
                    onRemove={() => cart.remove(item.id)}
                    onClick={() => setSelectedItem(item)}
                    isFavorite={favoritesSet.has(item.id)}
                    onToggleFavorite={(e) => toggleFavorite(item.id, e)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* SINGLE CATEGORY VIEW (When a specific category pill is clicked) */}
        {selectedCategory !== null && !searchQuery.trim() && (
          <section className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-[22px] sm:text-[26px] font-bold text-[#29231F]">
                {sortedCategories.find((c) => c.id === selectedCategory)?.name ??
                  displayCategories.find((c) => c.id === selectedCategory)?.name ??
                  "Menu Items"}
              </h2>
              <span className="text-xs text-[#766B61] font-medium">
                {filtered.length} {filtered.length === 1 ? "item" : "items"}
              </span>
            </div>
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-[#766B61] bg-[#FFFDF9] rounded-2xl border border-[#E5DDD1] p-6">
                <p className="text-sm font-medium">No items available under this category with current filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {filtered.map((item) => (
                  <FoodCard
                    key={item.id}
                    item={item}
                    cartQty={cartQtyMap.get(item.id) ?? 0}
                    onAdd={() => cart.add(item)}
                    onRemove={() => cart.remove(item.id)}
                    onClick={() => setSelectedItem(item)}
                    isFavorite={favoritesSet.has(item.id)}
                    onToggleFavorite={(e) => toggleFavorite(item.id, e)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ALL MENU VIEW (Default view showing Chef's Picks + Seasonal Banner + ALL Categories) */}
        {selectedCategory === null && !searchQuery.trim() && (
          <>
            {/* 1. Chef's Picks Section */}
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
                {(bestsellers.length > 0 ? bestsellers.slice(0, 6) : filtered.slice(0, 6)).map((item) => (
                  <FoodCard
                    key={item.id}
                    item={item}
                    cartQty={cartQtyMap.get(item.id) ?? 0}
                    onAdd={() => cart.add(item)}
                    onRemove={() => cart.remove(item.id)}
                    onClick={() => setSelectedItem(item)}
                    isFavorite={favoritesSet.has(item.id)}
                    onToggleFavorite={(e) => toggleFavorite(item.id, e)}
                  />
                ))}
              </div>
            </section>

            {/* 2. Seasonal Specials Banner */}
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
                        const dessert = sortedCategories.find((c) => c.name.toLowerCase().includes("dessert"));
                        if (dessert) setSelectedCategory(dessert.id);
                      }}
                      className="px-4 py-2 rounded-full bg-[#F8F5EF] text-[#29231F] font-semibold text-[11px] hover:bg-[#EFE7DA] transition-colors inline-flex items-center gap-1.5 shadow-2xs btn-smooth-press"
                    >
                      <span>Discover Now</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>

                <div className="col-span-5 relative flex items-center justify-end">
                  <div className="absolute -top-3.5 right-0 font-script text-[17px] sm:text-[20px] text-[#E5F0DF] -rotate-3 select-none">
                    Fresh Seasonal Local
                  </div>
                  <img
                    src={DEFAULT_SEASONAL_DISH}
                    alt="Seasonal Bowl Special"
                    loading="lazy"
                    decoding="async"
                    className="w-24 sm:w-32 h-24 sm:h-32 object-cover rounded-full border border-white/30 shadow-md"
                  />
                </div>
              </div>
            </section>

            {/* 3. Render Each Category Section With All Its Items */}
            {sortedCategories.length > 0 ? (
              sortedCategories.map((cat) => {
                const catItems = categoryItemsMap.get(cat.id) || [];
                if (catItems.length === 0) return null;
                return (
                  <section key={cat.id} className="space-y-3 pt-2 content-auto">
                    <div className="flex items-center justify-between border-b border-[#E5DDD1] pb-2">
                      <div className="flex items-center gap-2">
                        <div className="text-[#7B4E35]">
                          {getCategoryIcon(cat.name, 18)}
                        </div>
                        <h2 className="font-serif text-[20px] sm:text-[24px] font-bold text-[#29231F]">
                          {cat.name}
                        </h2>
                      </div>
                      <button
                        onClick={() => setSelectedCategory(cat.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#7B4E35] hover:underline"
                      >
                        <span>View ({catItems.length})</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                      {catItems.map((item) => (
                        <FoodCard
                          key={item.id}
                          item={item}
                          cartQty={cartQtyMap.get(item.id) ?? 0}
                          onAdd={() => cart.add(item)}
                          onRemove={() => cart.remove(item.id)}
                          onClick={() => setSelectedItem(item)}
                          isFavorite={favoritesSet.has(item.id)}
                          onToggleFavorite={(e) => toggleFavorite(item.id, e)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })
            ) : (
              /* If no categories grouped yet, show full list of all items */
              <section className="space-y-3 pt-2 content-auto">
                <div className="flex items-center justify-between border-b border-[#E5DDD1] pb-2">
                  <h2 className="font-serif text-[20px] sm:text-[24px] font-bold text-[#29231F]">
                    All Menu Items ({filtered.length})
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  {filtered.map((item) => (
                    <FoodCard
                      key={item.id}
                      item={item}
                      cartQty={cartQtyMap.get(item.id) ?? 0}
                      onAdd={() => cart.add(item)}
                      onRemove={() => cart.remove(item.id)}
                      onClick={() => setSelectedItem(item)}
                      isFavorite={favoritesSet.has(item.id)}
                      onToggleFavorite={(e) => toggleFavorite(item.id, e)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        </>
        )}
      </div>

      {/* ==================================================== */}
      {/* 6. FIXED BOTTOM NAVIGATION BAR                       */}
      {/* ==================================================== */}
      <nav
        aria-label="Customer Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#FFFDF9]/95 backdrop-blur-md border-t border-[#E5DDD1] pb-[max(0.625rem,env(safe-area-inset-bottom))]"
      >
        <div className="max-w-md mx-auto grid grid-cols-3 items-center px-2 py-1 sm:py-1.5">
          {[
            {
              id: "home",
              label: "Home",
              icon: HomeIcon,
              action: () => window.scrollTo({ top: 0, behavior: "smooth" }),
            },
            {
              id: "menu",
              label: "Menu",
              icon: Utensils,
              action: () =>
                document
                  .getElementById("category-scroller")
                  ?.scrollIntoView({ behavior: "smooth" }),
            },
            {
              id: "offers",
              label: "Offers",
              icon: Percent,
              action: () => setShowOffers(true),
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeNav === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveNav(tab.id as any);
                  tab.action();
                }}
                className="flex flex-col items-center justify-center min-h-[44px] py-1 px-2 relative transition-colors cursor-pointer select-none group"
              >
                <Icon
                  size={20}
                  className={`transition-colors ${
                    isActive ? "text-[#7B4E35]" : "text-[#766B61] group-hover:text-[#29231F]"
                  }`}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span
                  className={`text-[11px] leading-tight mt-0.5 transition-colors ${
                    isActive
                      ? "font-bold text-[#7B4E35]"
                      : "font-medium text-[#766B61] group-hover:text-[#29231F]"
                  }`}
                >
                  {tab.label}
                </span>
                {isActive ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7B4E35] mt-0.5" />
                ) : (
                  <span className="w-1.5 h-1.5 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Active Order Quick Bar */}
      {cart.count > 0 && !cartOpen && (
        <div
          className="fixed bottom-[max(4.5rem,calc(3.75rem+env(safe-area-inset-bottom)))] left-3 right-3 sm:left-4 sm:right-4 z-[45] max-w-md mx-auto"
        >
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#29231F] text-white shadow-xl cursor-pointer hover:bg-[#1E150F] btn-smooth-press text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#7B4E35] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {cart.count}
              </div>
              <div>
                <p className="text-xs font-bold leading-tight">View Current Order</p>
                <p className="text-[10px] text-stone-300">Tap to review & checkout</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-sm">{formatINR(cart.total)}</span>
              <ArrowRight size={14} className="text-[#D4A84D]" />
            </div>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-[120] flex justify-end bg-black/50 backdrop-blur-xs overscroll-contain"
          onClick={() => setCartOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#FFFDF9] h-[100dvh] max-h-[100dvh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#E5DDD1] bg-[#FFFDF9] flex-shrink-0">
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#29231F]">Your Order</h2>
                {hasTable && tableNumber ? (
                  <p className="text-xs text-[#766B61] flex items-center gap-1.5 mt-0.5">
                    <span>Table {tableNumber}</span>
                    {sessionData && (
                      <span>• Party of {sessionData.partySize} ({sessionMembersCount} Joined)</span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-[#766B61] flex items-center gap-1.5 mt-0.5">
                    <span>Digital Menu • Scan QR to order at table</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="w-9 h-9 rounded-full bg-[#F8F5EF] border border-[#E5DDD1] flex items-center justify-center text-[#29231F] hover:bg-[#EFE7DA] transition-colors btn-smooth-press"
                aria-label="Close Cart"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Item List & Notes */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 space-y-4">
              {cart.items.length === 0 ? (
                <div className="text-center py-20 text-[#766B61]">
                  <ShoppingBag size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">Your order is empty</p>
                  <p className="text-xs text-[#766B61]/80 mt-1">Add items from the menu to get started</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5">
                    {cart.items.map((i) => (
                      <div key={i.id} className="flex justify-between items-center p-3 rounded-2xl bg-[#F8F5EF] border border-[#E5DDD1]">
                        <div className="flex-1 pr-3">
                          <p className="font-serif font-bold text-sm text-[#29231F] leading-snug">{i.name}</p>
                          <p className="text-xs font-semibold text-[#7B4E35] mt-0.5">{formatINR(i.price)}</p>
                        </div>
                        <div className="flex items-center gap-2 bg-white rounded-full px-2.5 py-1 border border-[#E5DDD1] shadow-2xs">
                          <button
                            type="button"
                            onClick={() => cart.remove(i.id)}
                            className="text-[#7B4E35] w-5 h-5 flex items-center justify-center cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">{i.quantity}</span>
                          <button
                            type="button"
                            onClick={() => cart.add({ id: i.id, name: i.name, price: i.price } as any)}
                            className="text-[#7B4E35] w-5 h-5 flex items-center justify-center cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Kitchen Special Instructions / Notes */}
                  <div className="pt-2 space-y-1.5">
                    <label className="text-[11px] font-bold text-[#766B61] uppercase tracking-wider block">
                      Kitchen Notes / Special Requests
                    </label>
                    <input
                      type="text"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="e.g. Less spicy, extra hot coffee, oat milk..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F5EF] border border-[#E5DDD1] text-xs text-[#29231F] outline-none focus:border-[#7B4E35] transition-colors"
                    />
                  </div>

                  {/* Offers & Discounts */}
                  <div className="pt-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-[#766B61] uppercase tracking-wider block">
                        Offers & Discounts
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowOffers(true);
                          setCartOpen(false);
                        }}
                        className="text-[11px] text-[#7B4E35] font-semibold hover:underline flex items-center gap-1"
                      >
                        <Percent size={12} />
                        View Available Offers
                      </button>
                    </div>

                    {appliedOffer ? (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF3E6] border border-[#ECD7A9]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-[#ECD7A9] text-[#8E6314] flex items-center justify-center">
                            <Percent size={13} />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-[#8E6314]">
                                {appliedOffer.title}
                              </span>
                              <span className="text-[9px] font-bold uppercase tracking-wider bg-[#8E6314] text-white px-1.5 py-0.5 rounded">
                                Auto-Applied
                              </span>
                            </div>
                            <div className="text-[11px] text-[#766B61] mt-0.5">
                              Discount: -{formatINR(appliedOffer.discountAmount)}
                            </div>
                          </div>
                        </div>
                        <span className="font-serif font-bold text-xs text-[#8E6314]">
                          -{formatINR(appliedOffer.discountAmount)}
                        </span>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-[#F8F5EF] border border-[#E5DDD1] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#EFE7DA] text-[#766B61] flex items-center justify-center">
                            <Percent size={13} />
                          </div>
                          <span className="text-xs text-[#766B61]">
                            Best eligible offer applies automatically
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowOffers(true)}
                          className="text-xs font-semibold text-[#7B4E35] hover:underline"
                        >
                          Browse
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Sticky Drawer Footer with Place Order Button */}
            {cart.items.length > 0 && (
              <div className="flex-shrink-0 bg-[#FFFDF9] border-t border-[#E5DDD1] px-5 sm:px-6 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-3 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between items-center text-[#766B61]">
                    <span>Subtotal</span>
                    <span className="font-semibold text-[#29231F]">{formatINR(cart.total)}</span>
                  </div>
                  {appliedOffer && (
                    <div className="flex justify-between items-center text-emerald-700 font-semibold">
                      <span>Discount ({appliedOffer.title})</span>
                      <span>-{formatINR(appliedOffer.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center font-bold text-lg text-[#29231F] pt-1.5 border-t border-[#E5DDD1]">
                    <span>Total</span>
                    <span className="font-serif text-xl text-[#7B4E35]">
                      {formatINR(Math.max(0, Math.round((cart.total - (appliedOffer?.discountAmount || 0)) * 100) / 100))}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isPlacingOrder || cart.items.length === 0}
                  onClick={handlePlaceOrder}
                  className="w-full min-h-[48px] py-3.5 rounded-full bg-[#7B4E35] text-white font-bold text-sm hover:bg-[#633D28] active:scale-[0.98] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isPlacingOrder ? (
                    <span>Sending to Kitchen...</span>
                  ) : !hasTable ? (
                    <span>
                      Scan Table QR to Order • {formatINR(Math.max(0, Math.round((cart.total - (appliedOffer?.discountAmount || 0)) * 100) / 100))}
                    </span>
                  ) : (
                    <span>
                      Place Order • {formatINR(Math.max(0, Math.round((cart.total - (appliedOffer?.discountAmount || 0)) * 100) / 100))}
                    </span>
                  )}
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

      {/* ==================================================== */}
      {/* OFFERS & DEALS MODAL                                 */}
      {/* ==================================================== */}
      {showOffers && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => setShowOffers(false)}
        >
          <div
            className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-[#FFFDF9] rounded-3xl border border-[#E5DDD1] shadow-2xl p-5 sm:p-6 space-y-4 transform transition-all duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DDD1]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#EFE7DA] flex items-center justify-center text-[#7B4E35]">
                  <Percent size={18} />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#29231F]">Offers & Combos</h3>
                  <p className="text-[11px] text-[#766B61]">Exclusive discounts at {restaurantName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowOffers(false)}
                className="w-8 h-8 rounded-full bg-[#F8F5EF] border border-[#E5DDD1] flex items-center justify-center text-[#29231F] hover:bg-[#EFE7DA] btn-smooth-press"
              >
                <X size={15} />
              </button>
            </div>

            {/* Offer Cards List */}
            <div className="space-y-3.5 pt-1">
              {offersLoading ? (
                <div className="py-12 text-center text-[#766B61] space-y-2">
                  <Sparkles size={24} className="mx-auto text-[#D4A84D] animate-spin" />
                  <p className="text-xs">Loading active offers & combos...</p>
                </div>
              ) : offersList.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-3 bg-[#F8F5EF] rounded-2xl border border-[#E5DDD1]">
                  <div className="w-12 h-12 rounded-full bg-[#FAF3E6] border border-[#ECD7A9] flex items-center justify-center mx-auto text-[#8E6314]">
                    <Percent size={22} />
                  </div>
                  <h4 className="font-serif font-bold text-base text-[#29231F]">No Active Offers Right Now</h4>
                  <p className="text-xs text-[#766B61] max-w-xs mx-auto">
                    Check back soon! Our team regularly adds breakfast combos, seasonal brew discounts, and festive specials.
                  </p>
                </div>
              ) : (
                offersList.map((offer) => {
                  const hasImage = Boolean(offer.imageUrl);
                  const isCombo = offer.offerType === "combo";

                  return (
                    <div
                      key={offer.id}
                      className="rounded-2xl bg-[#F8F5EF] border border-[#E5DDD1] overflow-hidden space-y-3 shadow-2xs"
                    >
                      {/* Optional Image */}
                      {hasImage && (
                        <div className="relative h-32 w-full overflow-hidden bg-[#EFE7DA]">
                          <img
                            src={offer.imageUrl!}
                            alt={offer.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                          {offer.badge && (
                            <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#E8BA60] text-[#29231F] shadow-xs">
                              {offer.badge}
                            </span>
                          )}
                          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-white text-xs">
                            <span className="font-serif font-bold text-sm">
                              {isCombo
                                ? `Combo • ₹${offer.comboPrice}`
                                : offer.discountType === "percentage"
                                ? `${offer.discountValue}% OFF`
                                : `Flat ₹${offer.discountValue} OFF`}
                            </span>
                            {offer.minOrderAmount > 0 && (
                              <span className="text-[10px] bg-black/50 px-2 py-0.5 rounded backdrop-blur-xs">
                                Min: ₹{offer.minOrderAmount}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="p-4 pt-3 space-y-2.5">
                        {!hasImage && (
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-lg bg-[#EFE7DA] text-[#7B4E35] flex items-center justify-center">
                                {isCombo ? <Coffee size={14} /> : <Percent size={14} />}
                              </span>
                              {offer.badge && (
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#E8BA60] text-[#29231F]">
                                  {offer.badge}
                                </span>
                              )}
                            </div>
                            <span className="font-serif font-bold text-xs text-[#7B4E35]">
                              {isCombo
                                ? `₹${offer.comboPrice}`
                                : offer.discountType === "percentage"
                                ? `${offer.discountValue}% OFF`
                                : `₹${offer.discountValue} OFF`}
                            </span>
                          </div>
                        )}

                        <div>
                          <h4 className="font-serif font-bold text-[15px] text-[#29231F]">
                            {offer.title}
                          </h4>
                          {offer.description && (
                            <p className="text-xs text-[#766B61] leading-relaxed font-sans mt-0.5">
                              {offer.description}
                            </p>
                          )}
                        </div>

                        {/* Combo Included Items */}
                        {isCombo && Array.isArray(offer.comboItems) && offer.comboItems.length > 0 && (
                          <div className="p-2.5 rounded-xl bg-white/80 border border-[#E5DDD1] space-y-1">
                            <span className="text-[10px] font-bold text-[#29231F] uppercase tracking-wider block">
                              Included in Combo:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {offer.comboItems.map((ci, idx) => (
                                <span
                                  key={idx}
                                  className="bg-[#FAF3E6] text-[#8E6314] px-2 py-0.5 rounded-md text-[11px] font-medium border border-[#ECD7A9]/60"
                                >
                                  {ci.name} ×{ci.quantity}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Rules / Min Order */}
                        {!hasImage && offer.minOrderAmount > 0 && (
                          <div className="text-[11px] text-[#766B61] flex items-center gap-1">
                            <ShoppingBag size={12} />
                            <span>Valid on orders above ₹{offer.minOrderAmount}</span>
                          </div>
                        )}

                        {/* Bottom Action Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#E5DDD1]/70 gap-2">
                          <div className="flex items-center gap-1.5">
                            {appliedOffer?.id === offer.id ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full">
                                <Check size={12} />
                                Applied (-₹{appliedOffer.discountAmount})
                              </span>
                            ) : offer.minOrderAmount > 0 && cart.total < offer.minOrderAmount ? (
                              <span className="text-[11px] text-[#766B61]">
                                Min. order ₹{offer.minOrderAmount}
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-[#8E6314] bg-[#FAF3E6] px-2 py-1 rounded-lg">
                                Auto-applied
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isCombo && (
                              <button
                                type="button"
                                onClick={() => handleAddComboToCart(offer)}
                                className="px-3.5 py-1.5 rounded-full bg-[#7B4E35] text-white font-semibold text-xs hover:bg-[#633D28] transition-colors btn-smooth-press"
                              >
                                {appliedOffer?.id === offer.id ? "Add Combo Again" : "Add Combo"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setShowOffers(false)}
                className="w-full py-3 rounded-full bg-[#29231F] text-white font-medium text-xs hover:bg-black transition-colors btn-smooth-press"
              >
                Close Offers
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* CAFE LOCATIONS & HOURS MODAL                         */}
      {/* ==================================================== */}
      {showLocations && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => setShowLocations(false)}
        >
          <div
            className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-[#FFFDF9] rounded-3xl border border-[#E5DDD1] shadow-2xl p-5 sm:p-6 space-y-4 transform transition-all duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DDD1]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#EFE7DA] flex items-center justify-center text-[#7B4E35]">
                  <MapPin size={18} />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#29231F]">Our Locations</h3>
                  <p className="text-[11px] text-[#766B61]">Find a {restaurantName} near you</p>
                </div>
              </div>
              <button
                onClick={() => setShowLocations(false)}
                className="w-8 h-8 rounded-full bg-[#F8F5EF] border border-[#E5DDD1] flex items-center justify-center text-[#29231F] hover:bg-[#EFE7DA] btn-smooth-press"
              >
                <X size={15} />
              </button>
            </div>

            {/* Locations List */}
            <div className="space-y-3 pt-1">
              {[
                {
                  title: "Flagship Roastery & Café",
                  area: "Downtown / Park Avenue",
                  address: "142 Park Avenue, Central District, City",
                  hours: "Mon – Sun • 7:30 AM – 11:00 PM",
                  phone: "+91 98765 43210",
                  amenities: "Free High-Speed Wi-Fi • Outdoor Patio • Pet Friendly",
                },
                {
                  title: "Artisan Kitchen & Bakery",
                  area: "West End Boulevard",
                  address: "88 West End Boulevard, Near Metro Station",
                  hours: "Mon – Sun • 8:00 AM – 10:30 PM",
                  phone: "+91 98765 43211",
                  amenities: "Quiet Work Zone • Bakery Counter • Valet Parking",
                },
              ].map((loc, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-[#F8F5EF] border border-[#E5DDD1] space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-serif font-bold text-[15px] text-[#29231F]">{loc.title}</h4>
                      <p className="text-[11px] font-semibold text-[#7B4E35]">{loc.area}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-[#A7B89B] text-[#1E2819]">
                      Open Now
                    </span>
                  </div>

                  <p className="text-xs text-[#766B61] leading-relaxed font-sans">{loc.address}</p>

                  <div className="flex items-center gap-2 text-xs text-[#29231F] font-medium pt-0.5">
                    <Clock size={13} className="text-[#7B4E35]" />
                    <span>{loc.hours}</span>
                  </div>

                  <div className="text-[10px] text-[#766B61] bg-white px-2.5 py-1.5 rounded-lg border border-[#E5DDD1]">
                    {loc.amenities}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href={`tel:${loc.phone.replace(/\s+/g, "")}`}
                      className="flex-1 py-2 rounded-xl bg-white border border-[#E5DDD1] text-center text-xs font-semibold text-[#29231F] hover:bg-[#EFE7DA] transition-colors btn-smooth-press"
                    >
                      Call Café
                    </a>
                    <button
                      onClick={() => alert(`Opening navigation for ${loc.title}`)}
                      className="flex-1 py-2 rounded-xl bg-[#7B4E35] text-white text-center text-xs font-semibold hover:bg-[#633D28] transition-colors btn-smooth-press"
                    >
                      Get Directions
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setShowLocations(false)}
                className="w-full py-3 rounded-full bg-[#29231F] text-white font-medium text-xs hover:bg-black transition-colors btn-smooth-press"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* CURRENT ACTIVE ORDER MODAL                           */}
      {/* ==================================================== */}
      {showActiveOrderModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => setShowActiveOrderModal(false)}
        >
          <div
            className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-[#FFFDF9] rounded-3xl border border-[#E5DDD1] shadow-2xl p-5 sm:p-6 space-y-4 transform transition-all duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DDD1]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#EFE7DA] flex items-center justify-center text-[#7B4E35]">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#29231F]">Table Orders</h3>
                  <p className="text-[11px] text-[#766B61]">
                    Table {tableNumber || 1} • {sessionData ? `Party of ${sessionData.partySize} (${sessionMembersCount} Joined)` : restaurantName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowActiveOrderModal(false)}
                className="w-8 h-8 rounded-full bg-[#F8F5EF] border border-[#E5DDD1] flex items-center justify-center text-[#29231F] hover:bg-[#EFE7DA] btn-smooth-press"
              >
                <X size={15} />
              </button>
            </div>

            {/* If there are orders in this table session */}
            {sessionOrders.length > 0 || activeOrderId ? (
              <div className="space-y-4 pt-1">
                <div className="space-y-3">
                  {(sessionOrders.length > 0 ? sessionOrders : [activeOrderData].filter(Boolean)).map((ord: any) => {
                    const isPending = ord.status === "pending";
                    const isCancelled = ord.status === "cancelled";
                    const isCompleted = ord.status === "completed";

                    return (
                      <div
                        key={ord.id}
                        className={`p-4 rounded-2xl border space-y-3 ${
                          isCancelled
                            ? "bg-rose-50/50 border-rose-200 opacity-60"
                            : isCompleted
                              ? "bg-stone-50 border-stone-200"
                              : "bg-[#F8F5EF] border-[#E5DDD1]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-[10px] uppercase font-bold text-[#766B61] tracking-wider">
                                Order #{ord.id}
                              </p>
                              {ord.is_mine ? (
                                <span className="text-[9px] font-bold text-[#7B4E35] bg-[#FAF3E6] border border-[#ECD7A9] px-1.5 py-0.2 rounded-full">
                                  Your Order
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-stone-600 bg-stone-100 border border-stone-200 px-1.5 py-0.2 rounded-full">
                                  Guest at Table
                                </span>
                              )}
                            </div>
                            <h4 className="font-serif text-base font-bold text-[#29231F]">
                              {ord.status === "accepted"
                                ? "👍 Accepted by Staff"
                                : ord.status === "preparing"
                                ? "👨‍🍳 Kitchen is Preparing"
                                : ord.status === "ready"
                                  ? "✨ Ready to Serve!"
                                  : ord.status === "served"
                                    ? "🍽️ Order Served"
                                    : ord.status === "completed"
                                      ? "✓ Completed"
                                      : ord.status === "cancelled"
                                        ? "✕ Cancelled"
                                        : "⏳ Order Received"}
                            </h4>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              ord.status === "accepted"
                                ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                                : ord.status === "preparing"
                                ? "bg-blue-50 text-blue-800 border-blue-200"
                                : ord.status === "ready"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : ord.status === "served"
                                    ? "bg-teal-50 text-teal-800 border-teal-200"
                                    : ord.status === "completed"
                                      ? "bg-stone-100 text-stone-700 border-stone-200"
                                      : ord.status === "cancelled"
                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                        : "bg-amber-100 text-amber-900 border-amber-200"
                            }`}
                          >
                            {!["served", "completed", "cancelled"].includes(ord.status) && (
                              <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                            )}
                            {ord.status || "In Kitchen"}
                          </span>
                        </div>

                        {/* Order Items */}
                        <div className="space-y-1.5 pt-1">
                          {ord.order_items && ord.order_items.length > 0 ? (
                            ord.order_items.map((it: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex justify-between items-center p-2 rounded-xl bg-white/80 border border-[#E5DDD1]/60 text-xs"
                              >
                                <span className="font-medium text-[#29231F]">
                                  {it.quantity}x {it.item_name}
                                </span>
                                <span className="font-bold text-[#7B4E35]">
                                  {formatINR(it.price * it.quantity)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="p-2 rounded-xl bg-white/60 text-xs text-[#766B61]">
                              Items in kitchen
                            </div>
                          )}
                        </div>

                        {/* Order Subtotal & Cancel Action */}
                        <div className="flex justify-between items-center pt-2 border-t border-[#E5DDD1]/60 text-xs">
                          <span className="text-[#766B61]">Order Subtotal:</span>
                          <span className="font-bold text-[#29231F]">{formatINR(ord.total || 0)}</span>
                        </div>

                        {/* Guest cancel button: permitted only for their own order while pending */}
                        {ord.is_mine && isPending && (
                          <div className="pt-1 flex justify-end">
                            <button
                              onClick={() => handleCancelOrder(ord.id)}
                              disabled={cancellingOrderId === ord.id}
                              className="px-3 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-[11px] font-semibold transition-colors flex items-center gap-1 active:scale-95"
                            >
                              <X size={12} />
                              <span>{cancellingOrderId === ord.id ? "Cancelling..." : "Cancel My Order"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Combined Table Total */}
                <div className="flex justify-between items-center pt-3 border-t border-[#E5DDD1] font-bold text-base text-[#29231F]">
                  <span>Total Table Amount</span>
                  <span>
                    {formatINR(
                      sessionOrders.reduce(
                        (sum, o) => sum + (o.status !== "cancelled" ? Number(o.total || 0) : 0),
                        0
                      ) || activeOrderData?.total || cart.total || 0
                    )}
                  </span>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => {
                      setShowActiveOrderModal(false);
                      document.getElementById("category-scroller")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="w-full py-3 rounded-full bg-[#7B4E35] text-white font-medium text-xs hover:bg-[#633D28] transition-colors shadow-xs btn-smooth-press"
                  >
                    + Place Another Order for Table
                  </button>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => setShowBillModal(true)}
                      className="w-full py-2.5 rounded-full bg-white border border-[#E5DDD1] text-[#29231F] font-bold text-xs hover:bg-[#EFE7DA] transition-colors flex items-center justify-center gap-1.5 shadow-2xs btn-smooth-press"
                    >
                      <Receipt size={14} className="text-[#7B4E35]" />
                      <span>View Bill</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* No active order currently placed */
              <div className="py-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-[#EFE7DA] flex items-center justify-center mx-auto text-[#7B4E35]">
                  <ShoppingBag size={24} />
                </div>
                <div>
                  <h4 className="font-serif text-lg font-bold text-[#29231F]">No Table Orders Yet</h4>
                  <p className="text-xs text-[#766B61] mt-1 max-w-xs mx-auto">
                    No orders have been placed for Table {tableNumber || 1} in this session yet.
                  </p>
                </div>
                <div className="pt-2">
                  {cart.count > 0 ? (
                    <button
                      onClick={() => {
                        setShowActiveOrderModal(false);
                        setCartOpen(true);
                      }}
                      className="px-6 py-2.5 rounded-full bg-[#7B4E35] text-white font-semibold text-xs hover:bg-[#633D28] btn-smooth-press"
                    >
                      View Cart ({cart.count} items)
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setShowActiveOrderModal(false);
                        document.getElementById("category-scroller")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="px-6 py-2.5 rounded-full bg-[#7B4E35] text-white font-semibold text-xs hover:bg-[#633D28] btn-smooth-press"
                    >
                      Explore Menu & Order
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* NO TABLE / SCAN QR REQUIRED MODAL                   */}
      {/* ==================================================== */}
      {showNoTableModal && (
        <div className="fixed inset-0 z-[150] overflow-y-auto overscroll-contain bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center min-h-[100dvh]">
          <div className="w-full max-w-sm my-auto bg-[#FFFDF9] rounded-3xl border border-[#E5DDD1] shadow-2xl p-5 sm:p-7 text-center space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-[#EFF5EE] border border-[#B7D2B6] flex items-center justify-center mx-auto text-2xl shadow-xs text-[#1E4B2C]">
              <QrCode size={28} />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#1E4B2C] bg-[#EFF5EE] border border-[#B7D2B6] px-2.5 py-0.5 rounded-full inline-block">
                Table Service
              </span>
              <h2 className="font-serif text-xl font-bold text-[#29231F] pt-1">
                Scan Table QR to Order
              </h2>
              <p className="text-xs text-[#766B61] leading-relaxed">
                Table service requires scanning the QR code at your table to begin a dining session.
              </p>
            </div>

            <div className="p-3.5 bg-[#FAF3E6] rounded-2xl border border-[#ECD7A9] text-left space-y-2">
              <label className="text-[11px] font-bold text-[#7B4E35] uppercase tracking-wider block">
                Already seated at a table?
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 1, 2, 3..."
                  value={manualTableInput}
                  onChange={(e) => setManualTableInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const t = manualTableInput.trim();
                      if (t) {
                        window.location.href = `${window.location.pathname}?table=${encodeURIComponent(t)}`;
                      }
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-white rounded-xl border border-[#E5DDD1] text-xs font-semibold text-[#29231F] outline-none focus:border-[#7B4E35]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const t = manualTableInput.trim();
                    if (!t) return;
                    window.location.href = `${window.location.pathname}?table=${encodeURIComponent(t)}`;
                  }}
                  className="px-4 py-2 bg-[#7B4E35] text-white text-xs font-bold rounded-xl hover:bg-[#633E2B] transition-colors cursor-pointer"
                >
                  Join
                </button>
              </div>
            </div>

            <p className="text-[11px] text-[#766B61]">
              For takeaway orders, please place your order directly at the counter.
            </p>

            <button
              type="button"
              onClick={() => setShowNoTableModal(false)}
              className="w-full py-2.5 rounded-full border border-[#E5DDD1] bg-[#F8F5EF] text-[#29231F] text-xs font-semibold hover:bg-[#EFE7DA] transition-colors cursor-pointer"
            >
              Browse Menu
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 1. PARTY SIZE SELECTION (FIRST GUEST SCAN FLOW)      */}
      {/* ==================================================== */}
      {hasTable && sessionStatus === "needs_party_size" && (
        <div className="fixed inset-0 z-[150] overflow-y-auto overscroll-contain bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center min-h-[100dvh]">
          <div className="w-full max-w-sm my-auto bg-[#FFFDF9] rounded-3xl border border-[#E5DDD1] shadow-2xl p-5 sm:p-7 text-center space-y-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-[#FAF3E6] border border-[#ECD7A9] flex items-center justify-center mx-auto text-2xl shadow-xs">
              ☕
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#7B4E35] bg-[#FAF3E6] border border-[#ECD7A9] px-2.5 py-0.5 rounded-full inline-block">
                Table {tableNumber}
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#29231F] pt-1">
                How many people are in your party?
              </h2>
              <p className="text-xs text-[#766B61] leading-relaxed">
                Select your party size and tap Confirm to begin your table session. Guests scanning after you will join this session.
              </p>
            </div>

            {/* Exactly 4 Choices: 1, 2, 3, 4 */}
            <div className="grid grid-cols-4 gap-2.5 pt-1">
              {[1, 2, 3, 4].map((size) => {
                const isSelected = selectedPartySize === size;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedPartySize(size)}
                    className={`group relative flex flex-col items-center justify-center py-3.5 rounded-2xl border-2 transition-all shadow-xs cursor-pointer active:scale-95 ${
                      isSelected
                        ? "border-[#7B4E35] bg-[#FAF3E6] ring-2 ring-[#7B4E35]/25"
                        : "border-[#E5DDD1] bg-[#F8F5EF] hover:border-[#7B4E35]/60 hover:bg-[#FAF3E6]/60"
                    }`}
                  >
                    <span className={`font-serif text-2xl font-bold ${isSelected ? "text-[#7B4E35]" : "text-[#29231F]"}`}>
                      {size}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${isSelected ? "text-[#7B4E35]" : "text-[#766B61]"}`}>
                      {size === 1 ? "Solo" : size === 2 ? "Duo" : size === 3 ? "Trio" : "Party"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Prominent Confirm Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={!selectedPartySize || isJoiningSession}
                onClick={() => handleConfirmPartySize(selectedPartySize)}
                className="w-full min-h-[48px] py-3.5 rounded-full bg-[#7B4E35] text-white font-bold text-sm hover:bg-[#633E2B] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {isJoiningSession ? (
                  <span>Joining Table...</span>
                ) : (
                  <span>Confirm • Party of {selectedPartySize}</span>
                )}
              </button>
            </div>

            <div className="pt-1 text-[11px] text-[#766B61]/80">
              {restaurantName} • Contactless Dining
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. TABLE SESSION FULL REJECTION OVERLAY              */}
      {/* ==================================================== */}
      {hasTable && sessionStatus === "full" && (
        <div className="fixed inset-0 z-[150] overflow-y-auto overscroll-contain bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center min-h-[100dvh]">
          <div className="w-full max-w-sm my-auto bg-[#FFFDF9] rounded-3xl border border-rose-200 shadow-2xl p-6 sm:p-7 text-center space-y-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-500 shadow-xs">
              <Users size={28} />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 inline-block">
                Table {tableNumber}
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#29231F]">
                This table session is full
              </h2>
              <p className="text-xs text-[#766B61] leading-relaxed">
                This table has reached its maximum party size ({sessionData?.partySize || 4} guests). Additional guests cannot join this table session.
              </p>
            </div>

            <div className="p-3.5 bg-[#F8F5EF] rounded-xl border border-[#E5DDD1] text-xs text-[#766B61] text-left space-y-1">
              <p className="font-semibold text-[#29231F]">Need a larger table or assistance?</p>
              <p className="text-[11px]">Please ask our café staff to seat your party at an available table or adjust your table seating.</p>
            </div>

            <button
              type="button"
              onClick={() => initSession()}
              className="w-full min-h-[48px] py-3 rounded-full bg-[#7B4E35] text-white font-semibold text-xs hover:bg-[#633E2B] transition-colors shadow-xs cursor-pointer"
            >
              Check Table Status Again
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. TABLE SESSION FINISHED OVERLAY                    */}
      {/* ==================================================== */}
      {hasTable && sessionStatus === "finished" && (
        <div className="fixed inset-0 z-[150] overflow-y-auto overscroll-contain bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center min-h-[100dvh]">
          <div className="w-full max-w-sm my-auto bg-[#FFFDF9] rounded-3xl border border-[#E5DDD1] shadow-2xl p-6 sm:p-7 text-center space-y-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-[#FAF3E6] border border-[#ECD7A9] flex items-center justify-center mx-auto text-[#8E6314] shadow-xs">
              <CheckCircle size={28} />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#7B4E35] bg-[#FAF3E6] border border-[#ECD7A9] px-2.5 py-0.5 rounded-full inline-block">
                Table {tableNumber}
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#29231F]">
                Table Session Finished
              </h2>
              <p className="text-xs text-[#766B61] leading-relaxed">
                This table session has been closed by staff. Thank you for visiting {restaurantName}!
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(`table_guest_token_${tableNumber}`);
                localStorage.removeItem(`activeOrderId_${tableNumber}`);
                initSession();
              }}
              className="w-full min-h-[48px] py-3 rounded-full bg-[#7B4E35] text-white font-semibold text-xs hover:bg-[#633E2B] transition-colors shadow-xs cursor-pointer"
            >
              Start New Session
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* DETAILED BILL & TAX INVOICE MODAL                    */}
      {/* ==================================================== */}
      {showBillModal && (
        <div
          id="receipt-print-overlay"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => setShowBillModal(false)}
        >
          <div
            id="receipt-print-root"
            className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#FFFDF9] rounded-3xl border border-[#E5DDD1] shadow-2xl p-6 space-y-4 font-mono text-xs transform transition-all duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Receipt Top Header */}
            <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-[#DED4C7]">
              <div className="flex items-center justify-center gap-2 mb-1">
                <BotanicalLeaf className="w-5 h-5 text-[#29231F]" />
                <h3 className="font-serif text-lg font-bold text-[#29231F] font-sans tracking-tight">
                  {restaurantName}
                </h3>
              </div>
              <p className="text-[10px] text-[#766B61] uppercase tracking-widest font-sans">
                CAFÉ & ARTISAN KITCHEN
              </p>
              {settings?.address && <p className="text-[10px] text-[#766B61]">{settings.address}</p>}
              {settings?.gstin && <p className="text-[10px] text-[#766B61]">GSTIN: {settings.gstin}</p>}
            </div>

            {/* Bill Info Meta */}
            <div className="grid grid-cols-2 gap-1 py-2 text-[11px] text-[#29231F] border-b border-dashed border-[#DED4C7]">
              <div>
                <span className="text-[#766B61]">Table: </span>
                <span className="font-bold">Table {tableNumber || 1}</span>
              </div>
              <div className="text-right">
                <span className="text-[#766B61]">Order: </span>
                <span className="font-bold">#{activeOrderId || "102"}</span>
              </div>
              <div>
                <span className="text-[#766B61]">Date: </span>
                <span>{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>
              <div className="text-right">
                <span className="text-[#766B61]">Time: </span>
                <span>{new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>

            {/* Itemized Table */}
            {(() => {
              const activeSessionOrders = sessionOrders.filter((o: any) => o.status !== "cancelled");
              const effectiveOrders = activeSessionOrders.length > 0 ? activeSessionOrders : [activeOrderData].filter(Boolean);
              const allItems: any[] = [];
              effectiveOrders.forEach((ord: any) => {
                if (ord.order_items && Array.isArray(ord.order_items)) {
                  ord.order_items.forEach((it: any) => allItems.push(it));
                }
              });
              const billTotal = effectiveOrders.reduce((sum: number, ord: any) => sum + Number(ord.total || 0), 0) || cart.total || 0;
              const isPaid = effectiveOrders.length > 0 && effectiveOrders.every((ord: any) => ord.is_paid);

              return (
                <>
                  <div className="space-y-2 py-2">
                    <div className="flex justify-between font-bold text-[11px] text-[#766B61] border-b border-[#E5DDD1] pb-1 uppercase">
                      <span>Item</span>
                      <div className="flex gap-4">
                        <span className="w-8 text-center">Qty</span>
                        <span className="w-14 text-right">Amount</span>
                      </div>
                    </div>

                    {allItems.length > 0 ? (
                      allItems.map((it: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-[12px] text-[#29231F]">
                          <span className="font-medium truncate max-w-[180px]">{it.item_name}</span>
                          <div className="flex gap-4 items-center">
                            <span className="w-8 text-center text-[#766B61]">x{it.quantity}</span>
                            <span className="w-14 text-right font-bold">{formatINR(it.price * it.quantity)}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between items-center text-[12px] text-[#29231F]">
                        <span className="font-medium">Specialty Food & Drinks</span>
                        <div className="flex gap-4 items-center">
                          <span className="w-8 text-center text-[#766B61]">x1</span>
                          <span className="w-14 text-right font-bold">{formatINR(billTotal)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Financial Summary */}
                  <div className="pt-2 border-t-2 border-dashed border-[#DED4C7] space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-[#766B61]">
                      <span>Item Subtotal</span>
                      <span className="font-bold text-[#29231F]">{formatINR(billTotal * 0.952)}</span>
                    </div>
                    <div className="flex justify-between text-[#766B61]">
                      <span>CGST (2.5%)</span>
                      <span>{formatINR(billTotal * 0.024)}</span>
                    </div>
                    <div className="flex justify-between text-[#766B61]">
                      <span>SGST (2.5%)</span>
                      <span>{formatINR(billTotal * 0.024)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-[#E5DDD1] font-bold text-sm text-[#29231F]">
                      <span className="font-serif font-bold text-base">Grand Total</span>
                      <span className="text-base text-[#7B4E35]">{formatINR(billTotal)}</span>
                    </div>
                  </div>

                  {/* Payment Tag */}
                  <div className="p-3 rounded-xl bg-[#F8F5EF] border border-[#E5DDD1] text-center space-y-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#7B4E35]">
                      {isPaid ? "✓ PAID VIA DIGITAL ORDER" : "PAY AT COUNTER / UPI / CASH"}
                    </p>
                    <p className="text-[10px] text-[#766B61]">Thank you for dining at {restaurantName}!</p>
                  </div>
                </>
              );
            })()}

            {/* Receipt Modal Actions */}
            <div className="receipt-print-actions pt-2 space-y-2 font-sans">
              <button
                onClick={printReceipt}
                className="w-full py-2.5 rounded-full bg-[#7B4E35] text-white font-semibold text-xs hover:bg-[#633D28] transition-colors flex items-center justify-center gap-2 btn-smooth-press"
              >
                <Printer size={14} />
                <span>Print / Save Receipt</span>
              </button>
              <button
                onClick={() => setShowBillModal(false)}
                className="w-full py-2.5 rounded-full bg-[#F8F5EF] border border-[#E5DDD1] text-[#29231F] font-semibold text-xs hover:bg-[#EFE7DA] transition-colors btn-smooth-press"
              >
                Back to Current Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
