import React, { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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

type NavTab = "overview" | "menu" | "orders" | "qr" | "settings";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<NavTab>("overview");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

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
  const { data: orders = [] } = useListOrders({ query: q({ enabled: !!me }) });

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
    if (meError) setLocation("/admin/login");
  }, [meError, setLocation]);

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

  const pendingOrders = (orders as any[]).filter(
    (o) => o.status === "pending",
  ).length;
  const todayRevenue = (orders as any[])
    .filter((o) => {
      const d = new Date(o.createdAt);
      const now = new Date();
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
    })
    .reduce((s: number, o: any) => s + Number(o.totalAmount), 0);

  const NAV_ITEMS: { tab: NavTab; label: string; icon: React.ReactNode }[] = [
    { tab: "overview", label: "Overview", icon: <LayoutDashboard size={16} /> },
    { tab: "menu", label: "Menu", icon: <UtensilsCrossed size={16} /> },
    { tab: "orders", label: "Orders", icon: <ClipboardList size={16} /> },
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
            <h2 className="text-2xl font-serif font-bold text-foreground">
              Dashboard
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Items</CardDescription>
                  <CardTitle className="text-3xl">
                    {summary?.totalItems ?? 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Categories</CardDescription>
                  <CardTitle className="text-3xl">
                    {summary?.totalCategories ?? 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Pending Orders</CardDescription>
                  <CardTitle className="text-3xl text-yellow-500">
                    {pendingOrders}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Today's Revenue</CardDescription>
                  <CardTitle className="text-3xl text-primary">
                    ₹{Math.round(todayRevenue)}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="font-semibold text-foreground mb-3">
                  Quick Links
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveTab("menu")}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
                  >
                    <UtensilsCrossed size={14} /> Manage menu items
                  </button>
                  <button
                    onClick={() => setActiveTab("orders")}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
                  >
                    <ClipboardList size={14} /> View orders{" "}
                    {pendingOrders > 0 && (
                      <Badge
                        variant="destructive"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {pendingOrders} pending
                      </Badge>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab("qr")}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
                  >
                    <QrCode size={14} /> Generate QR codes
                  </button>
                  <button
                    onClick={() => setActiveTab("settings")}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
                  >
                    <Settings size={14} /> Restaurant settings
                  </button>
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="font-semibold text-foreground mb-3">
                  Recent Orders
                </h3>
                {(orders as any[]).slice(0, 4).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders yet</p>
                ) : (
                  <div className="space-y-2">
                    {(orders as any[]).slice(0, 4).map((o: any) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          Order #{o.id}
                          {o.tableNumber ? ` · T${o.tableNumber}` : ""}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            ₹{Math.round(o.totalAmount)}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                              o.status === "pending"
                                ? "bg-yellow-500/15 text-yellow-400"
                                : o.status === "completed"
                                  ? "bg-zinc-500/15 text-zinc-400"
                                  : "bg-green-500/15 text-green-400"
                            }`}
                          >
                            {o.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
        {activeTab === "qr" && <QRPage />}
        {activeTab === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}
