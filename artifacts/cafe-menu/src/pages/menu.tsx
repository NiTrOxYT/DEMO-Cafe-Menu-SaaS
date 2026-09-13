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
  Receipt,
  Printer,
  Download,
  CreditCard,
  Tag,
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

const DEFAULT_FALLBACK_MENU_ITEMS: MenuItem[] = [
  // 1. Coffee
  {
    id: 101,
    name: "Cappuccino",
    description: "Rich espresso with velvety steamed milk and rosetta art.",
    price: 150,
    imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
    categoryId: 1,
    categoryName: "Coffee",
    available: true,
    sortOrder: 1,
    isVeg: true,
    isBestseller: true,
    isSpicy: false,
    badge: "BESTSELLER",
  },
  {
    id: 102,
    name: "Espresso Macchiato",
    description: "Double shot espresso with a dollop of silky microfoam.",
    price: 130,
    imageUrl: "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=800&q=80",
    categoryId: 1,
    categoryName: "Coffee",
    available: true,
    sortOrder: 2,
    isVeg: true,
    isBestseller: false,
    isSpicy: false,
    badge: "CHEF'S PICK",
  },
  {
    id: 103,
    name: "Vanilla Flat White",
    description: "Smooth ristretto with silky microfoam and Madagascar vanilla.",
    price: 180,
    imageUrl: "https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=800&q=80",
    categoryId: 1,
    categoryName: "Coffee",
    available: true,
    sortOrder: 3,
    isVeg: true,
    isBestseller: false,
    isSpicy: false,
    badge: "NEW",
  },
  {
    id: 104,
    name: "Iced Spanish Latte",
    description: "Espresso with condensed milk poured over crystal ice cubes.",
    price: 210,
    imageUrl: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=800&q=80",
    categoryId: 1,
    categoryName: "Coffee",
    available: true,
    sortOrder: 4,
    isVeg: true,
    isBestseller: true,
    isSpicy: false,
    badge: "BESTSELLER",
  },

  // 2. Breakfast
  {
    id: 201,
    name: "Avocado Toast",
    description: "Sourdough, fresh smashed avocado, poached egg, chilli flakes.",
    price: 320,
    imageUrl: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80",
    categoryId: 2,
    categoryName: "Breakfast",
    available: true,
    sortOrder: 1,
    isVeg: false,
    isBestseller: false,
    isSpicy: true,
    badge: "CHEF'S PICK",
  },
  {
    id: 202,
    name: "Almond Butter Croissant",
    description: "Flaky butter croissant filled with almond frangipane cream.",
    price: 190,
    imageUrl: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80",
    categoryId: 2,
    categoryName: "Breakfast",
    available: true,
    sortOrder: 2,
    isVeg: true,
    isBestseller: true,
    isSpicy: false,
    badge: "BESTSELLER",
  },
  {
    id: 203,
    name: "Truffle Scrambled Eggs",
    description: "Farm fresh eggs, white truffle oil, chives on toasted brioche.",
    price: 290,
    imageUrl: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80",
    categoryId: 2,
    categoryName: "Breakfast",
    available: true,
    sortOrder: 3,
    isVeg: false,
    isBestseller: false,
    isSpicy: false,
    badge: "NEW",
  },
  {
    id: 204,
    name: "Acai Berry Bowl",
    description: "Organic acai, artisan granola, chia seeds, fresh blueberries & kiwi.",
    price: 340,
    imageUrl: "https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=800&q=80",
    categoryId: 2,
    categoryName: "Breakfast",
    available: true,
    sortOrder: 4,
    isVeg: true,
    isBestseller: false,
    isSpicy: false,
    badge: "CHEF'S PICK",
  },

  // 3. Starters
  {
    id: 301,
    name: "Truffle Parmesan Fries",
    description: "Hand-cut crispy potatoes, aromatic white truffle oil, shaved parmesan.",
    price: 240,
    imageUrl: "https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=800&q=80",
    categoryId: 3,
    categoryName: "Starters",
    available: true,
    sortOrder: 1,
    isVeg: true,
    isBestseller: true,
    isSpicy: false,
    badge: "BESTSELLER",
  },
  {
    id: 302,
    name: "Burrata Caprese Salad",
    description: "Heirloom tomatoes, fresh Italian burrata, basil pesto, balsamic glaze.",
    price: 360,
    imageUrl: "https://images.unsplash.com/photo-1592417817098-8f3d6910985b?auto=format&fit=crop&w=800&q=80",
    categoryId: 3,
    categoryName: "Starters",
    available: true,
    sortOrder: 2,
    isVeg: true,
    isBestseller: false,
    isSpicy: false,
    badge: "CHEF'S PICK",
  },
  {
    id: 303,
    name: "Crispy Calamari",
    description: "Tender calamari rings with garlic aioli, charred lemon, and herbs.",
    price: 380,
    imageUrl: "https://images.unsplash.com/photo-1604909052743-94e838986d24?auto=format&fit=crop&w=800&q=80",
    categoryId: 3,
    categoryName: "Starters",
    available: true,
    sortOrder: 3,
    isVeg: false,
    isBestseller: false,
    isSpicy: false,
    badge: "NEW",
  },

  // 4. Main Course
  {
    id: 401,
    name: "Wild Mushroom Risotto",
    description: "Creamy carnaroli rice, sauteed porcini, white wine, parmesan crisp.",
    price: 420,
    imageUrl: "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=800&q=80",
    categoryId: 4,
    categoryName: "Main Course",
    available: true,
    sortOrder: 1,
    isVeg: true,
    isBestseller: false,
    isSpicy: false,
    badge: "CHEF'S PICK",
  },
  {
    id: 402,
    name: "Artisanal Sourdough Margherita",
    description: "Slow-fermented crust, San Marzano tomatoes, fresh buffalo mozzarella, basil.",
    price: 450,
    imageUrl: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=800&q=80",
    categoryId: 4,
    categoryName: "Main Course",
    available: true,
    sortOrder: 2,
    isVeg: true,
    isBestseller: true,
    isSpicy: false,
    badge: "BESTSELLER",
  },
  {
    id: 403,
    name: "Grilled Herb Chicken Bowl",
    description: "Herb-marinated chicken breast, quinoa, roasted zucchini, lemon tahini dressing.",
    price: 410,
    imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
    categoryId: 4,
    categoryName: "Main Course",
    available: true,
    sortOrder: 3,
    isVeg: false,
    isBestseller: false,
    isSpicy: false,
    badge: "NEW",
  },

  // 5. Desserts
  {
    id: 501,
    name: "Chocolate Truffle",
    description: "Rich. Decadent. Unforgettable. Dark Belgian chocolate ganache.",
    price: 260,
    imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80",
    categoryId: 5,
    categoryName: "Desserts",
    available: true,
    sortOrder: 1,
    isVeg: true,
    isBestseller: false,
    isSpicy: false,
    badge: "NEW",
  },
  {
    id: 502,
    name: "Classic Italian Tiramisu",
    description: "Savoiardi ladyfingers soaked in espresso, mascarpone mousse, Dutch cocoa.",
    price: 290,
    imageUrl: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=800&q=80",
    categoryId: 5,
    categoryName: "Desserts",
    available: true,
    sortOrder: 2,
    isVeg: true,
    isBestseller: true,
    isSpicy: false,
    badge: "BESTSELLER",
  },
  {
    id: 503,
    name: "Basque Burnt Cheesecake",
    description: "Creamy caramelized crust cheesecake served with warm raspberry coulis.",
    price: 310,
    imageUrl: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=800&q=80",
    categoryId: 5,
    categoryName: "Desserts",
    available: true,
    sortOrder: 3,
    isVeg: true,
    isBestseller: false,
    isSpicy: false,
    badge: "CHEF'S PICK",
  },

  // 6. Beverages
  {
    id: 601,
    name: "Iced Matcha Latte",
    description: "Uji ceremonial grade green tea matcha with organic oat milk.",
    price: 230,
    imageUrl: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=800&q=80",
    categoryId: 6,
    categoryName: "Beverages",
    available: true,
    sortOrder: 1,
    isVeg: true,
    isBestseller: true,
    isSpicy: false,
    badge: "BESTSELLER",
  },
  {
    id: 602,
    name: "Passionfruit Sparkling Cooler",
    description: "Fresh passionfruit pulp, sparkling soda, mint sprigs, lime.",
    price: 180,
    imageUrl: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
    categoryId: 6,
    categoryName: "Beverages",
    available: true,
    sortOrder: 2,
    isVeg: true,
    isBestseller: false,
    isSpicy: false,
    badge: "NEW",
  },
  {
    id: 603,
    name: "Cold Pressed Green Detox",
    description: "Cucumber, green apple, celery, spinach, ginger, lime.",
    price: 200,
    imageUrl: "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=800&q=80",
    categoryId: 6,
    categoryName: "Beverages",
    available: true,
    sortOrder: 3,
    isVeg: true,
    isBestseller: false,
    isSpicy: false,
    badge: "CHEF'S PICK",
  },
];

const DEFAULT_FALLBACK_CATEGORIES = [
  { id: 1, name: "Coffee", sortOrder: 1 },
  { id: 2, name: "Breakfast", sortOrder: 2 },
  { id: 3, name: "Starters", sortOrder: 3 },
  { id: 4, name: "Main Course", sortOrder: 4 },
  { id: 5, name: "Desserts", sortOrder: 5 },
  { id: 6, name: "Beverages", sortOrder: 6 },
];

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
    <motion.div
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={onClick}
      className="group flex flex-col bg-[#FFFDF9] rounded-2xl border border-[#E5DDD1] overflow-hidden shadow-[0_2px_10px_rgba(41,35,31,0.03)] hover:shadow-[0_8px_20px_rgba(41,35,31,0.07)] transition-all duration-300 cursor-pointer min-w-0 btn-smooth-press"
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
        <motion.button
          type="button"
          whileTap={{ scale: 0.8 }}
          onClick={onToggleFavorite}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/20 backdrop-blur-xs flex items-center justify-center text-white hover:text-[#D84040] transition-colors z-10"
          aria-label="Favorite"
        >
          <Heart size={14} fill={isFavorite ? "#D84040" : "none"} strokeWidth={2} />
        </motion.button>

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
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.85 }}
                  onClick={onAdd}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#7B4E35] text-white flex items-center justify-center hover:bg-[#633D28] transition-colors shadow-xs"
                  aria-label={`Add ${item.name}`}
                >
                  <Plus size={15} />
                </motion.button>
              ) : (
                <div className="flex items-center gap-1.5 bg-[#EFE7DA] border border-[#D8CEBF] rounded-full px-1.5 py-0.5 shadow-xs">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.8 }}
                    onClick={onRemove}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[#7B4E35]"
                  >
                    <Minus size={11} />
                  </motion.button>
                  <span className="text-xs font-bold text-[#29231F] min-w-3 text-center">
                    {cartQty}
                  </span>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.8 }}
                    onClick={onAdd}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[#7B4E35]"
                  >
                    <Plus size={11} />
                  </motion.button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </motion.div>
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
  const [showActiveOrderModal, setShowActiveOrderModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeOrderData, setActiveOrderData] = useState<any>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const categoryBarRef = useRef<HTMLDivElement>(null);

  const copyPromoCode = (code: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

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
          const updatedTotal = existingOrder.total + cart.total;
          await supabase
            .from("orders")
            .update({
              subtotal: existingOrder.subtotal + cart.total,
              total: updatedTotal,
              status: ["preparing", "ready", "completed"].includes(existingOrder.status)
                ? "pending"
                : existingOrder.status,
              is_updated: true,
              latest_added_items: cart.items.map((item) => `${item.quantity}x ${item.name}`),
            })
            .eq("id", existingOrderId);

          setActiveOrderData({
            ...existingOrder,
            total: updatedTotal,
            status: "pending",
          });

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
      setActiveOrderData(order);

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

      try {
        const { data } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("id", orderId)
          .single();

        if (!data || data.status === "completed" || data.is_paid === true) {
          localStorage.removeItem(`activeOrderId_${tableNumber}`);
          setActiveOrderId(null);
          setActiveOrderData(null);
          return;
        }
        setActiveOrderId(orderId);
        setActiveOrderData(data);
      } catch (e) {
        console.error("Failed to load active order", e);
      }
    };

    checkActiveOrder();
    const interval = setInterval(checkActiveOrder, 10000);
    return () => clearInterval(interval);
  }, [tableNumber]);

  const rawItems = (menuItems && menuItems.length > 0)
    ? (menuItems as MenuItem[])
    : DEFAULT_FALLBACK_MENU_ITEMS;

  const rawCategories = (categories && categories.length > 0)
    ? categories
    : DEFAULT_FALLBACK_CATEGORIES;

  const sortedCategories = [...rawCategories].sort((a, b) => a.sortOrder - b.sortOrder);

  // Filtered menu items
  const filtered = rawItems.filter((item) => {
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

  const bestsellers = rawItems.filter((i) => i.available && (i.isBestseller || i.badge === "BESTSELLER" || i.badge === "CHEF'S PICK"));

  // Category pill list including static mock fallback matching reference image
  const displayCategories = [
    { id: null, name: "All", icon: "all" },
    ...sortedCategories.map((c) => ({ id: c.id, name: c.name, icon: c.name.toLowerCase() })),
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
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setCartOpen(true)}
            className="relative w-10 h-10 rounded-xl bg-[#FFFDF9] border border-[#E5DDD1] flex items-center justify-center text-[#29231F] shadow-2xs hover:bg-[#EFE7DA] transition-colors btn-smooth-press"
            aria-label="Shopping Cart"
          >
            <ShoppingBag size={17} />
            {cart.count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-[#7B4E35] text-white text-[10px] font-bold flex items-center justify-center">
                {cart.count}
              </span>
            )}
          </motion.button>

          {/* Current Order Button */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              if (activeOrderId || (cart.items.length === 0 && !activeOrderId)) {
                setShowActiveOrderModal(true);
              } else {
                setCartOpen(true);
              }
            }}
            className="relative px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#E5DDD1] flex items-center gap-1.5 text-[#29231F] shadow-2xs hover:bg-[#EFE7DA] transition-colors text-xs font-semibold btn-smooth-press"
            aria-label="Current Order"
          >
            <Clock size={15} className="text-[#7B4E35]" />
            <span className="text-[11px] font-semibold text-[#29231F]">Order</span>
            {activeOrderId && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </motion.button>
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
        {/* 2. HERO BANNER SECTION (Exact Match to Reference)    */}
        {/* ==================================================== */}
        <section className="relative overflow-hidden rounded-[22px] md:rounded-[28px] border border-[#DED4C7] bg-[#F7F3EB] shadow-[0_8px_30px_rgba(70,48,34,0.06)] min-h-[300px] sm:min-h-[340px] md:min-h-[380px] flex items-center">
          {/* Background Banner Image from public/banner.png */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <img
              src="/banner.png"
              alt="The Golden Brew Cafe Banner"
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
              <motion.button
                whileTap={{ scale: 0.94 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => {
                  document.getElementById("category-scroller")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-[#54321E] text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-2 hover:bg-[#3D2314] transition-colors shadow-md btn-smooth-press"
              >
                <span>Explore Menu</span>
                <ArrowRight size={13} />
              </motion.button>
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
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#766B61]"
            >
              <X size={14} />
            </motion.button>
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
                <motion.button
                  key={cat.name + idx}
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ y: -2 }}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex flex-col items-center justify-center min-w-[72px] sm:min-w-[80px] h-[74px] sm:h-[80px] rounded-2xl p-2 transition-all flex-shrink-0 btn-smooth-press ${
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
                </motion.button>
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
                <motion.button
                  key={f.id}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setVegFilter(f.id as any)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all btn-smooth-press ${
                    isSelected
                      ? "bg-[#7B4E35] text-white shadow-xs"
                      : "bg-[#FFFDF9] text-[#766B61] border border-[#E5DDD1] hover:bg-[#EFE7DA]"
                  }`}
                >
                  {Icon && <Icon size={12} className={f.id === "veg" ? "text-emerald-600" : f.id === "nonveg" ? "text-rose-500" : ""} />}
                  <span>{f.label}</span>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* ==================================================== */}
        {/* 4. CHEF'S PICKS & FULL MENU CATEGORY SECTIONS        */}
        {/* ==================================================== */}

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
                    cartQty={cart.items.find((i) => i.id === item.id)?.quantity ?? 0}
                    onAdd={() => cart.add(item)}
                    onRemove={() => cart.remove(item.id)}
                    onClick={() => setSelectedItem(item)}
                    isFavorite={favorites.includes(item.id)}
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
                    cartQty={cart.items.find((i) => i.id === item.id)?.quantity ?? 0}
                    onAdd={() => cart.add(item)}
                    onRemove={() => cart.remove(item.id)}
                    onClick={() => setSelectedItem(item)}
                    isFavorite={favorites.includes(item.id)}
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
                      className="px-4 py-2 rounded-full bg-[#F8F5EF] text-[#29231F] font-semibold text-[11px] hover:bg-[#EFE7DA] transition-colors inline-flex items-center gap-1.5 shadow-sm"
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
                    className="w-24 sm:w-32 h-24 sm:h-32 object-cover rounded-full border border-white/30 shadow-lg"
                  />
                </div>
              </div>
            </section>

            {/* 3. Render Each Category Section With All Its Items */}
            {sortedCategories.length > 0 ? (
              sortedCategories.map((cat) => {
                const catItems = filtered.filter((i) => i.categoryId === cat.id);
                if (catItems.length === 0) return null;
                return (
                  <section key={cat.id} className="space-y-3 pt-2">
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
                );
              })
            ) : (
              /* If no categories grouped yet, show full list of all items */
              <section className="space-y-3 pt-2">
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
          </>
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

      {/* ==================================================== */}
      {/* OFFERS & DEALS MODAL                                 */}
      {/* ==================================================== */}
      <AnimatePresence>
        {showOffers && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
            onClick={() => setShowOffers(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-[#FFFDF9] rounded-3xl border border-[#E5DDD1] shadow-2xl p-5 sm:p-6 space-y-4"
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
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setShowOffers(false)}
                  className="w-8 h-8 rounded-full bg-[#F8F5EF] border border-[#E5DDD1] flex items-center justify-center text-[#29231F] hover:bg-[#EFE7DA] btn-smooth-press"
                >
                  <X size={15} />
                </motion.button>
              </div>

              {/* Offer Cards List */}
              <div className="space-y-3 pt-1">
                {[
                  {
                    code: "MORNING20",
                    title: "20% OFF Breakfast Combo",
                    desc: "Order any handcrafted specialty coffee with a croissant or avocado toast before 11:30 AM.",
                    badge: "Daily until 11:30 AM",
                    bgBadge: "bg-[#E8BA60] text-[#29231F]",
                  },
                  {
                    code: "GOLDENBREW",
                    title: "Buy 2 Coffees, Get 1 Pastry",
                    desc: "Order any 2 signature espresso or cold brew drinks and receive a complimentary artisan pastry.",
                    badge: "All-Day Special",
                    bgBadge: "bg-[#DFBA79] text-[#29231F]",
                  },
                  {
                    code: "FLAT75",
                    title: "Flat ₹75 OFF on QR Orders",
                    desc: "Enjoy ₹75 instant savings on orders above ₹300 placed directly from your table.",
                    badge: "Min Order ₹300",
                    bgBadge: "bg-[#A7B89B] text-[#1E2819]",
                  },
                  {
                    code: "HAPPYHOUR",
                    title: "15% OFF Desserts & Coolers",
                    desc: "Relax during afternoon hours with 15% discount on all cakes, tarts, and botanical coolers.",
                    badge: "4:00 PM – 7:00 PM",
                    bgBadge: "bg-[#EAE2D5] text-[#29231F]",
                  },
                ].map((offer, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-[#F8F5EF] border border-[#E5DDD1] space-y-2.5 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider mb-1 ${offer.bgBadge}`}>
                          {offer.badge}
                        </span>
                        <h4 className="font-serif font-bold text-[15px] text-[#29231F]">{offer.title}</h4>
                      </div>
                    </div>

                    <p className="text-xs text-[#766B61] leading-relaxed font-sans">{offer.desc}</p>

                    <div className="flex items-center justify-between pt-1 border-t border-[#E5DDD1]/70">
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#7B4E35] bg-white px-2.5 py-1 rounded-lg border border-[#E5DDD1]">
                        <Tag size={12} />
                        <span>{offer.code}</span>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={() => copyPromoCode(offer.code)}
                        className="px-4 py-1.5 rounded-full bg-[#7B4E35] text-white font-semibold text-xs hover:bg-[#633D28] transition-colors btn-smooth-press"
                      >
                        {copiedCode === offer.code ? "✓ Copied!" : "Apply Code"}
                      </motion.button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-center">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowOffers(false)}
                  className="w-full py-3 rounded-full bg-[#29231F] text-white font-medium text-xs hover:bg-black transition-colors btn-smooth-press"
                >
                  Close Offers
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================== */}
      {/* CAFE LOCATIONS & HOURS MODAL                         */}
      {/* ==================================================== */}
      <AnimatePresence>
        {showLocations && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
            onClick={() => setShowLocations(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-[#FFFDF9] rounded-3xl border border-[#E5DDD1] shadow-2xl p-5 sm:p-6 space-y-4"
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
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setShowLocations(false)}
                  className="w-8 h-8 rounded-full bg-[#F8F5EF] border border-[#E5DDD1] flex items-center justify-center text-[#29231F] hover:bg-[#EFE7DA] btn-smooth-press"
                >
                  <X size={15} />
                </motion.button>
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
                      <motion.a
                        whileTap={{ scale: 0.94 }}
                        href={`tel:${loc.phone.replace(/\s+/g, "")}`}
                        className="flex-1 py-2 rounded-xl bg-white border border-[#E5DDD1] text-center text-xs font-semibold text-[#29231F] hover:bg-[#EFE7DA] transition-colors btn-smooth-press"
                      >
                        Call Café
                      </motion.a>
                      <motion.button
                        whileTap={{ scale: 0.94 }}
                        onClick={() => alert(`Opening navigation for ${loc.title}`)}
                        className="flex-1 py-2 rounded-xl bg-[#7B4E35] text-white text-center text-xs font-semibold hover:bg-[#633D28] transition-colors btn-smooth-press"
                      >
                        Get Directions
                      </motion.button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-center">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowLocations(false)}
                  className="w-full py-3 rounded-full bg-[#29231F] text-white font-medium text-xs hover:bg-black transition-colors btn-smooth-press"
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================== */}
      {/* CURRENT ACTIVE ORDER MODAL                           */}
      {/* ==================================================== */}
      <AnimatePresence>
        {showActiveOrderModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
            onClick={() => setShowActiveOrderModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-[#FFFDF9] rounded-3xl border border-[#E5DDD1] shadow-2xl p-5 sm:p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#E5DDD1]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#EFE7DA] flex items-center justify-center text-[#7B4E35]">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-bold text-[#29231F]">Current Order</h3>
                    <p className="text-[11px] text-[#766B61]">Table {tableNumber || 1} • {restaurantName}</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setShowActiveOrderModal(false)}
                  className="w-8 h-8 rounded-full bg-[#F8F5EF] border border-[#E5DDD1] flex items-center justify-center text-[#29231F] hover:bg-[#EFE7DA] btn-smooth-press"
                >
                  <X size={15} />
                </motion.button>
              </div>

              {/* If there is an active order in kitchen */}
              {activeOrderId ? (
                <div className="space-y-4 pt-1">
                  {/* Status Card */}
                  <div className="p-4 rounded-2xl bg-[#F8F5EF] border border-[#E5DDD1] space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-[#766B61] tracking-wider">Order #{activeOrderId}</p>
                        <h4 className="font-serif text-lg font-bold text-[#29231F]">
                          {activeOrderData?.status === "preparing"
                            ? "👨‍🍳 Kitchen is Preparing"
                            : activeOrderData?.status === "ready"
                            ? "✨ Order is Ready!"
                            : "⏳ Order Received"}
                        </h4>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-amber-100 text-amber-900 border border-amber-200">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        {activeOrderData?.status || "In Kitchen"}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-[#766B61]">
                        <span>Estimated Time</span>
                        <span className="font-bold text-[#29231F]">~10-15 mins</span>
                      </div>
                      <div className="w-full h-2 bg-[#E5DDD1] rounded-full overflow-hidden">
                        <div className="h-full bg-[#7B4E35] rounded-full w-2/3 animate-pulse" />
                      </div>
                    </div>
                  </div>

                  {/* Items Ordered List */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-[#29231F] uppercase tracking-wider">Items on Table</p>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {activeOrderData?.order_items && activeOrderData.order_items.length > 0 ? (
                        activeOrderData.order_items.map((it: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-[#F8F5EF] text-xs">
                            <span className="font-medium text-[#29231F]">{it.quantity}x {it.item_name}</span>
                            <span className="font-bold text-[#7B4E35]">{formatINR(it.price * it.quantity)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="p-2.5 rounded-xl bg-[#F8F5EF] text-xs text-[#766B61]">
                          Order items sent to kitchen display
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center pt-3 border-t border-[#E5DDD1] font-bold text-base text-[#29231F]">
                    <span>Total Amount</span>
                    <span>{formatINR(activeOrderData?.total || cart.total || 0)}</span>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => {
                        setShowActiveOrderModal(false);
                        document.getElementById("category-scroller")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="w-full py-3 rounded-full bg-[#7B4E35] text-white font-medium text-xs hover:bg-[#633D28] transition-colors shadow-xs btn-smooth-press"
                    >
                      + Add More Items to Table
                    </motion.button>

                    <div className="grid grid-cols-2 gap-2">
                      <motion.button
                        whileTap={{ scale: 0.94 }}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => setShowBillModal(true)}
                        className="py-2.5 rounded-full bg-white border border-[#E5DDD1] text-[#29231F] font-bold text-xs hover:bg-[#EFE7DA] transition-colors flex items-center justify-center gap-1.5 shadow-2xs btn-smooth-press"
                      >
                        <Receipt size={14} className="text-[#7B4E35]" />
                        <span>View Bill</span>
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.94 }}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => alert(`Server called for Table ${tableNumber || 1}. A team member will assist you shortly!`)}
                        className="py-2.5 rounded-full bg-[#F8F5EF] border border-[#E5DDD1] text-[#29231F] font-semibold text-xs hover:bg-[#EFE7DA] transition-colors btn-smooth-press"
                      >
                        Call Server
                      </motion.button>
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
                    <h4 className="font-serif text-lg font-bold text-[#29231F]">No Active Order</h4>
                    <p className="text-xs text-[#766B61] mt-1 max-w-xs mx-auto">
                      You haven't placed an order for Table {tableNumber || 1} yet.
                    </p>
                  </div>
                  <div className="pt-2">
                    {cart.count > 0 ? (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        whileHover={{ scale: 1.01 }}
                        onClick={() => {
                          setShowActiveOrderModal(false);
                          setCartOpen(true);
                        }}
                        className="px-6 py-2.5 rounded-full bg-[#7B4E35] text-white font-semibold text-xs hover:bg-[#633D28] btn-smooth-press"
                      >
                        View Cart ({cart.count} items)
                      </motion.button>
                    ) : (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        whileHover={{ scale: 1.01 }}
                        onClick={() => {
                          setShowActiveOrderModal(false);
                          document.getElementById("category-scroller")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="px-6 py-2.5 rounded-full bg-[#7B4E35] text-white font-semibold text-xs hover:bg-[#633D28] btn-smooth-press"
                      >
                        Explore Menu & Order
                      </motion.button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================== */}
      {/* DETAILED BILL & TAX INVOICE MODAL                    */}
      {/* ==================================================== */}
      <AnimatePresence>
        {showBillModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
            onClick={() => setShowBillModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#FFFDF9] rounded-3xl border border-[#E5DDD1] shadow-2xl p-6 space-y-4 font-mono text-xs"
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
                <p className="text-[10px] text-[#766B61]">142 Park Avenue, Central District</p>
                <p className="text-[10px] text-[#766B61]">GSTIN: 07AAAAA0000A1Z5</p>
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
              <div className="space-y-2 py-2">
                <div className="flex justify-between font-bold text-[11px] text-[#766B61] border-b border-[#E5DDD1] pb-1 uppercase">
                  <span>Item</span>
                  <div className="flex gap-4">
                    <span className="w-8 text-center">Qty</span>
                    <span className="w-14 text-right">Amount</span>
                  </div>
                </div>

                {activeOrderData?.order_items && activeOrderData.order_items.length > 0 ? (
                  activeOrderData.order_items.map((it: any, idx: number) => (
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
                      <span className="w-14 text-right font-bold">{formatINR(activeOrderData?.total || cart.total || 0)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Financial Summary */}
              <div className="pt-2 border-t-2 border-dashed border-[#DED4C7] space-y-1.5 text-[11px]">
                <div className="flex justify-between text-[#766B61]">
                  <span>Item Subtotal</span>
                  <span className="font-bold text-[#29231F]">{formatINR(activeOrderData?.total ? activeOrderData.total * 0.952 : (cart.total || 0) * 0.952)}</span>
                </div>
                <div className="flex justify-between text-[#766B61]">
                  <span>CGST (2.5%)</span>
                  <span>{formatINR(activeOrderData?.total ? activeOrderData.total * 0.024 : (cart.total || 0) * 0.024)}</span>
                </div>
                <div className="flex justify-between text-[#766B61]">
                  <span>SGST (2.5%)</span>
                  <span>{formatINR(activeOrderData?.total ? activeOrderData.total * 0.024 : (cart.total || 0) * 0.024)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[#E5DDD1] font-bold text-sm text-[#29231F]">
                  <span className="font-serif font-bold text-base">Grand Total</span>
                  <span className="text-base text-[#7B4E35]">{formatINR(activeOrderData?.total || cart.total || 0)}</span>
                </div>
              </div>

              {/* Payment Tag */}
              <div className="p-3 rounded-xl bg-[#F8F5EF] border border-[#E5DDD1] text-center space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#7B4E35]">
                  {activeOrderData?.is_paid ? "✓ PAID VIA DIGITAL ORDER" : "PAY AT COUNTER / UPI / CASH"}
                </p>
                <p className="text-[10px] text-[#766B61]">Thank you for dining at {restaurantName}!</p>
              </div>

              {/* Receipt Modal Actions */}
              <div className="pt-2 space-y-2 font-sans">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => window.print()}
                  className="w-full py-2.5 rounded-full bg-[#7B4E35] text-white font-semibold text-xs hover:bg-[#633D28] transition-colors flex items-center justify-center gap-2 btn-smooth-press"
                >
                  <Printer size={14} />
                  <span>Print / Save Receipt</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowBillModal(false)}
                  className="w-full py-2.5 rounded-full bg-[#F8F5EF] border border-[#E5DDD1] text-[#29231F] font-semibold text-xs hover:bg-[#EFE7DA] transition-colors btn-smooth-press"
                >
                  Back to Current Order
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
