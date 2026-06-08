import React, { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/lib/supabase";
import * as z from "zod";
import {
  useGetMe,
  useLogout,
  useGetMenuSummary,
  useListMenuItems,
  useListCategories,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useCreateCategory,
  useDeleteCategory,
  useListOrders,
} from "@/lib/api";
import { useUpload } from "@/lib/storage";
import {
  Loader2,
  LogOut,
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Upload,
  X,
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  QrCode,
  Settings,
  BarChart3,
  Activity,
  ArrowUpRight,
  BadgeIndianRupee,
  Clock3,
  Layers,
  RefreshCw,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMeQueryKey,
  getListMenuItemsQueryKey,
  getGetMenuSummaryQueryKey,
  getListCategoriesQueryKey,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import OrdersPage from "./orders";
import QRPage from "./qr";
import AnalyticsPage from "./analytics";
import SettingsPage from "./settings";

const menuItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be positive"),
  imageUrl: z.string().optional().or(z.literal("")),
  categoryId: z.coerce.number().min(1, "Category is required"),
  available: z.boolean().default(true),
  sortOrder: z.coerce.number().default(0),
  isVeg: z.boolean().default(true),
  isBestseller: z.boolean().default(false),
  isSpicy: z.boolean().default(false),
});

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  sortOrder: z.coerce.number().default(0),
});

type MenuItemFormValues = z.infer<typeof menuItemSchema>;
type CategoryFormValues = z.infer<typeof categorySchema>;

function getImageSrc(imageUrl?: string | null) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("/objects/")) return `/api/storage${imageUrl}`;
  return imageUrl;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const OVERVIEW_STATUS_COLORS: Record<string, string> = {
  pending: "#d97706",
  preparing: "#2563eb",
  ready: "#059669",
  completed: "#18181b",
  cancelled: "#dc2626",
};

function ImageUploadField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(getImageSrc(value));
  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (res) => {
      onChange(res.objectPath);
      setPreview(`/api/storage${res.objectPath}`);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    await uploadFile(file);
  };

  const handleClear = () => {
    onChange("");
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />
      {preview ? (
        <div className="relative w-full h-36 rounded-lg overflow-hidden border border-border bg-muted">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover"
          />
          {isUploading && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
              <span className="text-white text-xs">{progress}%</span>
            </div>
          )}
          {!isUploading && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full h-36 rounded-lg border-2 border-dashed border-border hover:border-primary/50 bg-muted/30 hover:bg-muted/60 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <Upload className="h-7 w-7" />
          <span className="text-sm font-medium">Click to upload image</span>
          <span className="text-xs">JPG, PNG, WebP</span>
        </button>
      )}
      {preview && !isUploading && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" /> Change image
        </Button>
      )}
    </div>
  );
}

type NavTab = "overview" | "menu" | "orders" | "analytics" | "qr" | "settings";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<NavTab>("overview");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newOrderPopup, setNewOrderPopup] = useState(false);
  const [latestOrder, setLatestOrder] = useState<any>(null);
  // const [audioEnabled, setAudioEnabled] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState("");
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  async function fetchOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrders(data);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (opts: any) => opts;
  const {
    data: me,
    isLoading: meLoading,
    isError: meError,
  } = useGetMe({ query: q({ retry: false }) });
  const { data: summary, isLoading: summaryLoading } = useGetMenuSummary({
    query: q({ enabled: !!me }),
  });
  const { data: items, isLoading: itemsLoading } = useListMenuItems(undefined, {
    query: q({ enabled: !!me }),
  });
  const { data: categories } = useListCategories({
    query: q({ enabled: !!me }),
  });
  // const [orders, setOrders] = useState<any[]>([]);

  const logoutMutation = useLogout();
  const deleteItemMutation = useDeleteMenuItem();
  const createItemMutation = useCreateMenuItem();
  const updateItemMutation = useUpdateMenuItem();
  const createCategoryMutation = useCreateCategory();
  const deleteCategoryMutation = useDeleteCategory();

  const itemForm = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      imageUrl: "",
      categoryId: 0,
      available: true,
      sortOrder: 0,
      isVeg: true,
      isBestseller: false,
      isSpicy: false,
    },
  });

  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", sortOrder: 0 },
  });

  React.useEffect(() => {
    fetchOrders();
  }, []);

  React.useEffect(() => {
    audioRef.current = new Audio("/sounds/order.mp3");
    audioRef.current.preload = "auto";

    const unlock = () => {
      const audio = audioRef.current;

      if (!audio) return;

      audio.muted = true;

      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        })
        .catch(console.error);

      window.removeEventListener("click", unlock);
    };

    window.addEventListener("click", unlock);

    return () => {
      window.removeEventListener("click", unlock);
    };
  }, []);

  React.useEffect(() => {
    const channel = supabase
      .channel("admin-order-notifications")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          console.log(payload);

          if (payload.eventType === "INSERT") {
            setLatestOrder(payload.new);

            fetchOrders();

            setNewOrderPopup(true);

            toast({
              title: "🔔 New Order",
              description: `Order #${payload.new.id}`,
            });
          }

          if (payload.eventType === "UPDATE") {
            setLatestOrder(payload.new);

            fetchOrders();

            setNewOrderPopup(true);

            toast({
              title: "➕ Order Updated",
              description: `Items added to Order #${payload.new.id}`,
            });
          }

          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(console.error);
          }

          setTimeout(() => {
            setNewOrderPopup(false);
          }, 8000);
        },
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (
    meLoading ||
    (activeTab === "overview" && (itemsLoading || summaryLoading))
  ) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!me) return null;

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(getGetMeQueryKey(), null);
        setLocation("/admin/login");
      },
    });
  };

  const handleDeleteItem = (id: number) => {
    if (!window.confirm("Delete this item?")) return;
    deleteItemMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListMenuItemsQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getGetMenuSummaryQueryKey(),
          });
          toast({ description: "Item deleted" });
        },
      },
    );
  };

  const handleDeleteCategory = (id: number) => {
    if (!window.confirm("Delete this category?")) return;
    deleteCategoryMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListCategoriesQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getListMenuItemsQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getGetMenuSummaryQueryKey(),
          });
          toast({ description: "Category deleted" });
        },
      },
    );
  };

  const openEditItemDialog = (item: any) => {
    setEditingItem(item);
    itemForm.reset({
      name: item.name,
      description: item.description || "",
      price: item.price,
      imageUrl: item.imageUrl || "",
      categoryId: item.categoryId,
      available: item.available,
      sortOrder: item.sortOrder,
      isVeg: item.isVeg ?? true,
      isBestseller: item.isBestseller ?? false,
      isSpicy: item.isSpicy ?? false,
    });
    setItemDialogOpen(true);
  };

  const openNewItemDialog = () => {
    setEditingItem(null);
    itemForm.reset({
      name: "",
      description: "",
      price: 0,
      imageUrl: "",
      categoryId: categories?.[0]?.id || 0,
      available: true,
      sortOrder: 0,
      isVeg: true,
      isBestseller: false,
      isSpicy: false,
    });
    setItemDialogOpen(true);
  };

  const onItemSubmit = (data: MenuItemFormValues) => {
    const payload = {
      ...data,
      imageUrl: data.imageUrl || undefined,
      description: data.description || undefined,
    };
    if (editingItem) {
      updateItemMutation.mutate(
        { id: editingItem.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListMenuItemsQueryKey(),
            });
            queryClient.invalidateQueries({
              queryKey: getGetMenuSummaryQueryKey(),
            });
            setItemDialogOpen(false);
            toast({ description: "Item updated" });
          },
        },
      );
    } else {
      createItemMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListMenuItemsQueryKey(),
            });
            queryClient.invalidateQueries({
              queryKey: getGetMenuSummaryQueryKey(),
            });
            setItemDialogOpen(false);
            toast({ description: "Item created" });
          },
        },
      );
    }
  };

  const onCategorySubmit = (data: CategoryFormValues) => {
    createCategoryMutation.mutate(
      { data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListCategoriesQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getGetMenuSummaryQueryKey(),
          });
          setCategoryDialogOpen(false);
          categoryForm.reset();
          toast({ description: "Category created" });
        },
      },
    );
  };

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const pendingOrders = (orders as any[]).filter(
    (o) => o.status === "pending",
  ).length;
  const activeOrders = (orders as any[]).filter(
    (o) => !["completed", "cancelled"].includes(o.status || ""),
  ).length;
  const todayOrders = (orders as any[]).filter((o) =>
    isSameDay(new Date(o.created_at), now),
  );
  const todayRevenue = todayOrders.reduce(
    (s: number, o: any) => s + Number(o.total ?? 0),
    0,
  );
  const yesterdayRevenue = (orders as any[])
    .filter((o) => isSameDay(new Date(o.created_at), yesterday))
    .reduce((s: number, o: any) => s + Number(o.total ?? 0), 0);
  const revenueDelta =
    yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
      : todayRevenue > 0
        ? 100
        : 0;
  const avgOrderToday = todayOrders.length
    ? todayRevenue / todayOrders.length
    : 0;

  const NAV_ITEMS: { tab: NavTab; label: string; icon: React.ReactNode }[] = [
    { tab: "overview", label: "Overview", icon: <LayoutDashboard size={16} /> },
    { tab: "menu", label: "Menu", icon: <UtensilsCrossed size={16} /> },
    { tab: "orders", label: "Orders", icon: <ClipboardList size={16} /> },
    {
      tab: "analytics",
      label: "Analytics",
      icon: <BarChart3 size={16} />,
    },
    { tab: "qr", label: "QR Codes", icon: <QrCode size={16} /> },
    { tab: "settings", label: "Settings", icon: <Settings size={16} /> },
  ];

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-serif font-semibold text-foreground">
              The Golden Brew
            </h1>
            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map(({ tab, label, icon }) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {icon} {label}
                  {tab === "orders" && pendingOrders > 0 && (
                    <span className="ml-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {pendingOrders}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-muted-foreground">
              {me.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="md:hidden flex overflow-x-auto gap-1 px-4 pb-2 scrollbar-none">
          {NAV_ITEMS.map(({ tab, label, icon }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  Command center
                </p>
                <h2 className="mt-1 text-3xl font-serif font-bold text-foreground">
                  Overview
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Live snapshot of orders, revenue, and restaurant operations.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    revenueDelta >= 0
                      ? "bg-emerald-500/15 text-emerald-700"
                      : "bg-red-500/15 text-red-700"
                  }`}
                >
                  {revenueDelta >= 0 ? "+" : ""}
                  {Math.round(revenueDelta)}% vs yesterday
                </span>
                <Button variant="outline" size="sm" onClick={fetchOrders}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <OverviewMetricTile
                icon={<BadgeIndianRupee className="h-5 w-5" />}
                label="Today's revenue"
                value={formatCurrency(todayRevenue)}
                detail={`${todayOrders.length} orders today`}
              />
              <OverviewMetricTile
                icon={<Clock3 className="h-5 w-5" />}
                label="Pending orders"
                value={pendingOrders.toString()}
                detail={`${activeOrders} active in pipeline`}
              />
              <OverviewMetricTile
                icon={<UtensilsCrossed className="h-5 w-5" />}
                label="Menu items"
                value={(summary?.totalItems ?? 0).toString()}
                detail={`${summary?.totalCategories ?? 0} categories live`}
              />
              <OverviewMetricTile
                icon={<ArrowUpRight className="h-5 w-5" />}
                label="Average ticket"
                value={formatCurrency(avgOrderToday)}
                detail="Per order today"
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-serif text-xl font-semibold">
                      Recent orders
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Latest tickets flowing through the kitchen.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setActiveTab("orders")}
                  >
                    View all
                    <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
                {(orders as any[]).length === 0 ? (
                  <div className="border border-dashed border-border bg-card/70 rounded-lg px-6 py-10 text-center">
                    <Sparkles className="mx-auto h-7 w-7 text-secondary" />
                    <h4 className="mt-3 font-serif font-semibold">
                      No orders yet
                    </h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Orders will appear here as customers start scanning.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                          <th className="py-3 font-semibold">Order</th>
                          <th className="py-3 font-semibold">Table</th>
                          <th className="py-3 font-semibold">Time</th>
                          <th className="py-3 font-semibold">Status</th>
                          <th className="py-3 text-right font-semibold">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(orders as any[]).slice(0, 6).map((o: any) => (
                          <tr
                            key={o.id}
                            className="border-b border-border/60"
                          >
                            <td className="py-3 font-bold">#{o.id}</td>
                            <td className="py-3 text-muted-foreground">
                              {o.table_id || o.tableNumber
                                ? `Table ${o.table_id ?? o.tableNumber}`
                                : "Walk-in"}
                            </td>
                            <td className="py-3 text-muted-foreground">
                              {new Date(o.created_at).toLocaleString("en-IN", {
                                day: "numeric",
                                month: "short",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="py-3">
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs font-bold capitalize"
                                style={{
                                  color:
                                    OVERVIEW_STATUS_COLORS[o.status] ||
                                    "#78716c",
                                }}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      OVERVIEW_STATUS_COLORS[o.status] ||
                                      "#78716c",
                                  }}
                                />
                                {o.status || "unknown"}
                              </span>
                            </td>
                            <td className="py-3 text-right font-bold">
                              {formatCurrency(Number(o.total ?? 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <OverviewInsightTile
                  icon={<ShoppingBag className="h-5 w-5" />}
                  label="Active pipeline"
                  value={`${activeOrders} orders`}
                  detail={
                    pendingOrders > 0
                      ? `${pendingOrders} waiting for kitchen confirmation`
                      : "No pending tickets right now"
                  }
                />
                <OverviewInsightTile
                  icon={<Activity className="h-5 w-5" />}
                  label="Menu coverage"
                  value={`${summary?.totalItems ?? 0} dishes`}
                  detail={`Organized across ${summary?.totalCategories ?? 0} categories`}
                />
                <OverviewInsightTile
                  icon={<Layers className="h-5 w-5" />}
                  label="Operations"
                  value="Quick actions"
                  detail="Jump straight into the tools you use most."
                />
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <OverviewActionCard
                icon={<UtensilsCrossed className="h-4 w-4" />}
                title="Manage menu"
                description="Add items, update pricing, and control availability."
                onClick={() => setActiveTab("menu")}
              />
              <OverviewActionCard
                icon={<ClipboardList className="h-4 w-4" />}
                title="View orders"
                description={
                  pendingOrders > 0
                    ? `${pendingOrders} pending tickets need attention.`
                    : "Monitor live order flow and status updates."
                }
                badge={
                  pendingOrders > 0 ? `${pendingOrders} pending` : undefined
                }
                onClick={() => setActiveTab("orders")}
              />
              <OverviewActionCard
                icon={<BarChart3 className="h-4 w-4" />}
                title="Open analytics"
                description="Dive into revenue trends, peak hours, and top sellers."
                onClick={() => setActiveTab("analytics")}
              />
              <OverviewActionCard
                icon={<QrCode className="h-4 w-4" />}
                title="QR codes"
                description="Generate table QR codes for contactless ordering."
                onClick={() => setActiveTab("qr")}
              />
            </section>
          </div>
        )}

        {/* MENU TAB */}
        {activeTab === "menu" && (
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-full md:w-3/4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-serif font-bold text-foreground">
                  Menu Items
                </h2>
                <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={openNewItemDialog}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingItem ? "Edit Item" : "Add Menu Item"}
                      </DialogTitle>
                    </DialogHeader>
                    <Form {...itemForm}>
                      <form
                        onSubmit={itemForm.handleSubmit(onItemSubmit)}
                        className="space-y-4"
                      >
                        <FormField
                          control={itemForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={itemForm.control}
                            name="price"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Price (₹)</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.01" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={itemForm.control}
                            name="categoryId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Category</FormLabel>
                                <Select
                                  onValueChange={(v) =>
                                    field.onChange(Number(v))
                                  }
                                  value={
                                    field.value
                                      ? String(field.value)
                                      : undefined
                                  }
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {categories?.map((c) => (
                                      <SelectItem
                                        key={c.id}
                                        value={String(c.id)}
                                      >
                                        {c.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={itemForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea rows={2} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={itemForm.control}
                          name="imageUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Image URL</FormLabel>

                              <FormControl>
                                <Input
                                  placeholder="https://example.com/image.jpg"
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-3 gap-3">
                          <FormField
                            control={itemForm.control}
                            name="isVeg"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <FormLabel className="text-sm">Veg</FormLabel>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={itemForm.control}
                            name="isBestseller"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <FormLabel className="text-sm">Best</FormLabel>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={itemForm.control}
                            name="isSpicy"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <FormLabel className="text-sm">Spicy</FormLabel>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={itemForm.control}
                            name="sortOrder"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Sort Order</FormLabel>
                                <FormControl>
                                  <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={itemForm.control}
                            name="available"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 mt-[32px]">
                                <FormLabel className="text-base">
                                  Available
                                </FormLabel>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button
                          type="submit"
                          className="w-full"
                          disabled={
                            createItemMutation.isPending ||
                            updateItemMutation.isPending
                          }
                        >
                          {createItemMutation.isPending ||
                          updateItemMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          {editingItem ? "Save Changes" : "Create Item"}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Category
                      </TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Tags
                      </TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Status
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items?.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="h-28 text-center text-muted-foreground"
                        >
                          No items. Add your first item.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items
                        ?.sort(
                          (a, b) =>
                            a.categoryId - b.categoryId ||
                            a.sortOrder - b.sortOrder,
                        )
                        .map((item) => {
                          const imgSrc = getImageSrc(item.imageUrl);
                          return (
                            <TableRow key={item.id}>
                              <TableCell>
                                {imgSrc ? (
                                  <div className="w-9 h-9 rounded overflow-hidden bg-muted">
                                    <img
                                      src={imgSrc}
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-9 h-9 rounded bg-muted flex items-center justify-center text-muted-foreground">
                                    <ImageIcon className="h-4 w-4" />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="font-medium text-sm">
                                {item.name}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                {item.categoryName}
                              </TableCell>
                              <TableCell className="text-sm font-semibold">
                                ₹{Number(item.price).toFixed(0)}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <div className="flex gap-1">
                                  <span
                                    className={`w-3 h-3 rounded-sm border-2 flex items-center justify-center ${(item as any).isVeg ? "border-green-500" : "border-red-500"}`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${(item as any).isVeg ? "bg-green-500" : "bg-red-500"}`}
                                    />
                                  </span>
                                  {(item as any).isBestseller && (
                                    <span className="text-[10px] px-1 bg-amber-500/15 text-amber-400 rounded font-semibold">
                                      ⭐
                                    </span>
                                  )}
                                  {(item as any).isSpicy && (
                                    <span className="text-[10px] px-1 bg-red-500/15 text-red-400 rounded font-semibold">
                                      🌶
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {item.available ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-green-500/10 text-green-500 border-green-500/20 text-xs"
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    On
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="bg-destructive/10 text-destructive border-destructive/20 text-xs"
                                  >
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Off
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEditItemDialog(item)}
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDeleteItem(item.id)}
                                    disabled={
                                      deleteItemMutation.isPending &&
                                      (deleteItemMutation.variables as any)
                                        ?.id === item.id
                                    }
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="w-full md:w-1/4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-serif font-bold text-foreground">
                  Categories
                </h2>
                <Dialog
                  open={categoryDialogOpen}
                  onOpenChange={setCategoryDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      New
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[380px]">
                    <DialogHeader>
                      <DialogTitle>Add Category</DialogTitle>
                    </DialogHeader>
                    <Form {...categoryForm}>
                      <form
                        onSubmit={categoryForm.handleSubmit(onCategorySubmit)}
                        className="space-y-4"
                      >
                        <FormField
                          control={categoryForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={categoryForm.control}
                          name="sortOrder"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sort Order</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="w-full"
                          disabled={createCategoryMutation.isPending}
                        >
                          {createCategoryMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Create
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableBody>
                    {categories
                      ?.sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium text-sm">
                            {c.name}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteCategory(c.id)}
                              disabled={
                                deleteCategoryMutation.isPending &&
                                (deleteCategoryMutation.variables as any)
                                  ?.id === c.id
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    {categories?.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-center text-muted-foreground py-4 text-sm"
                        >
                          No categories
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "orders" && <OrdersPage />}
        {activeTab === "analytics" && <AnalyticsPage />}
        {activeTab === "qr" && <QRPage />}
        {activeTab === "settings" && <SettingsPage />}
      </main>
      {newOrderPopup && (
        <div className="fixed top-5 right-5 z-[9999]">
          {/* <div className="bg-card border border-primary/20 rounded-2xl p-5 shadow-2xl w-80"> */}
          {/* <div className="text-lg font-bold mb-2">{notificationTitle}</div> */}

          {/* <div className="text-sm text-muted-foreground mb-1">
              Order #{latestOrder?.id ?? "-"}
            </div>

            <div className="text-sm text-muted-foreground mb-4">
              ₹{latestOrder?.total ?? 0}
            </div> */}

          {/* <Button className="w-full" onClick={() => setNewOrderPopup(false)}>
              View Order
            </Button> */}
          {/* </div> */}
        </div>
      )}
    </div>
  );
}

function OverviewMetricTile({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-md bg-background p-2 text-secondary">{icon}</div>
        <Activity className="h-4 w-4 text-muted-foreground/50" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function OverviewInsightTile({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-primary p-2 text-primary-foreground">
          {icon}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 text-lg font-bold">{value}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function OverviewActionCard({
  icon,
  title,
  description,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-md bg-background p-2 text-secondary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          {icon}
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 transition-colors group-hover:text-primary" />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <p className="font-serif text-lg font-semibold">{title}</p>
        {badge && (
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-700">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
  );
}
