import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Boxes,
  Plus,
  Minus,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  History,
  Settings2,
  TrendingDown,
  TrendingUp,
  Package,
  Layers,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  User,
  Info,
} from "lucide-react";
import {
  useInventorySummary,
  useInventoryItems,
  useInventoryMovements,
  adjustInventory,
  updateInventorySettings,
  useListCategories,
  MenuItem,
  InventoryMovement,
} from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function InventoryDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Filters State
  const [datePreset, setDatePreset] = useState<"today" | "yesterday" | "7d" | "30d" | "all" | "custom">("7d");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Active Tab
  const [activeTab, setActiveTab] = useState<"items" | "movements">("items");

  // Modals State
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<MenuItem | null>(null);
  const [adjustType, setAdjustType] = useState<"stock_in" | "stock_out">("stock_in");
  const [adjustQty, setAdjustQty] = useState<string>("");
  const [adjustUnit, setAdjustUnit] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState<string>("");
  const [adjustDate, setAdjustDate] = useState<string>("");
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // Settings Modal State
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsItem, setSettingsItem] = useState<MenuItem | null>(null);
  const [settingsTrack, setSettingsTrack] = useState<boolean>(false);
  const [settingsQty, setSettingsQty] = useState<string>("");
  const [settingsUnit, setSettingsUnit] = useState<string>("portions");
  const [settingsThreshold, setSettingsThreshold] = useState<string>("5");
  const [isSubmittingSettings, setIsSubmittingSettings] = useState(false);

  // Compute ISO dates for datePreset
  const { startDateStr, endDateStr } = useMemo(() => {
    const now = new Date();
    if (datePreset === "all") {
      return { startDateStr: undefined, endDateStr: undefined };
    }
    if (datePreset === "custom") {
      return {
        startDateStr: customStartDate ? new Date(customStartDate).toISOString() : undefined,
        endDateStr: customEndDate ? new Date(customEndDate).toISOString() : undefined,
      };
    }
    if (datePreset === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      return { startDateStr: start.toISOString(), endDateStr: now.toISOString() };
    }
    if (datePreset === "yesterday") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      return { startDateStr: start.toISOString(), endDateStr: end.toISOString() };
    }
    if (datePreset === "7d") {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startDateStr: start.toISOString(), endDateStr: now.toISOString() };
    }
    if (datePreset === "30d") {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { startDateStr: start.toISOString(), endDateStr: now.toISOString() };
    }
    return { startDateStr: undefined, endDateStr: undefined };
  }, [datePreset, customStartDate, customEndDate]);

  // Queries
  const { data: categories = [] } = useListCategories();

  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useInventorySummary({
    startDate: startDateStr,
    endDate: endDateStr,
    categoryId: selectedCategoryId || undefined,
    menuItemId: selectedMenuItemId || undefined,
  });

  const {
    data: items = [],
    isLoading: isItemsLoading,
    refetch: refetchItems,
  } = useInventoryItems({
    categoryId: selectedCategoryId || undefined,
    search: searchQuery || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  // Complete unfiltered list of menu items for dialog selection and modal operations
  const { data: allMenuItems = [] } = useInventoryItems();

  const {
    data: movementsData,
    isLoading: isMovementsLoading,
    refetch: refetchMovements,
  } = useInventoryMovements({
    menuItemId: selectedMenuItemId || undefined,
    startDate: startDateStr,
    endDate: endDateStr,
    limit: 100,
  });

  const movements = movementsData?.movements || [];

  // Handlers
  const handleOpenAdjust = (item?: MenuItem | null, type: "stock_in" | "stock_out" = "stock_in") => {
    // Pick the passed item, or first tracked item, or first available item
    const targetItem =
      item ||
      allMenuItems.find((i) => i.trackInventory) ||
      items.find((i) => i.trackInventory) ||
      allMenuItems[0] ||
      items[0] ||
      null;

    setAdjustItem(targetItem);
    setAdjustType(type);
    setAdjustQty("");
    setAdjustUnit(targetItem?.inventoryUnit || "portions");
    setAdjustReason(type === "stock_in" ? "Fresh batch restock" : "Kitchen prep deduction / waste");
    setAdjustDate(new Date().toISOString().substring(0, 16));
    setAdjustModalOpen(true);
  };

  const handleOpenSettings = (item: MenuItem) => {
    setSettingsItem(item);
    setSettingsTrack(Boolean(item.trackInventory));
    setSettingsQty(item.inventoryQuantity !== undefined ? String(item.inventoryQuantity) : "0");
    setSettingsUnit(item.inventoryUnit || "portions");
    setSettingsThreshold(item.lowStockThreshold !== undefined ? String(item.lowStockThreshold) : "5");
    setSettingsModalOpen(true);
  };

  const handleSubmitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) {
      toast({
        title: "No Item Selected",
        description: "Please select a menu item to adjust.",
        variant: "destructive",
      });
      return;
    }

    const qty = parseFloat(adjustQty);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid positive quantity greater than 0.",
        variant: "destructive",
      });
      return;
    }

    if (adjustType === "stock_out") {
      const current = Number(adjustItem.inventoryQuantity || 0);
      if (current - qty < 0) {
        toast({
          title: "Negative Stock Prevented",
          description: `Current stock is ${current} ${adjustUnit}. Cannot deduct ${qty}.`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setIsSubmittingAdjust(true);
      await adjustInventory({
        menuItemId: adjustItem.id,
        movementType: adjustType,
        quantity: qty,
        unit: adjustUnit.trim() || undefined,
        reason: adjustReason.trim() || undefined,
        date: adjustDate ? new Date(adjustDate).toISOString() : undefined,
      });

      toast({
        title: adjustType === "stock_in" ? "Stock In Recorded" : "Stock Out Recorded",
        description: `${qty} ${adjustUnit} ${adjustType === "stock_in" ? "added to" : "deducted from"} ${adjustItem.name}.`,
      });

      // On success: close and reset dialog values
      setAdjustModalOpen(false);
      setAdjustQty("");
      setAdjustReason("");

      // Refresh item balance, movement history, Stock In totals, and low-stock alerts
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/menu"] }),
        refetchSummary(),
        refetchItems(),
        refetchMovements(),
      ]);
    } catch (err: any) {
      toast({
        title: "Adjustment Failed",
        description: err.message || "Failed to record adjustment.",
        variant: "destructive",
      });
      // On failure: keep the entered values intact in state
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  const handleSubmitSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsItem) return;

    const qty = parseFloat(settingsQty);
    const threshold = parseFloat(settingsThreshold);

    try {
      setIsSubmittingSettings(true);
      await updateInventorySettings(settingsItem.id, {
        trackInventory: settingsTrack,
        inventoryQuantity: !isNaN(qty) && qty >= 0 ? qty : 0,
        inventoryUnit: settingsUnit.trim() || "portions",
        lowStockThreshold: !isNaN(threshold) && threshold >= 0 ? threshold : 5,
      });

      toast({
        title: "Inventory Settings Saved",
        description: `Updated tracking settings for ${settingsItem.name}.`,
      });

      setSettingsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    } catch (err: any) {
      toast({
        title: "Failed to Save Settings",
        description: err.message || "Could not update inventory settings.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingSettings(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FAF3E6] border border-[#ECD7A9] flex items-center justify-center text-[#7B4E35] shadow-2xs">
              <Boxes size={20} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-foreground tracking-tight">
                Menu Item Stock & Inventory
              </h2>
              <p className="text-xs text-muted-foreground">
                Real-time stock on hand, automatic order consumption, restocks, and movement audit trail.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/inventory")}
            className="border-[#ECD7A9] bg-[#FAF3E6]/60 text-[#7B4E35] hover:bg-[#FAF3E6] text-xs h-9 gap-1.5"
            title="Raw Materials & Supplies Dashboard"
          >
            <Boxes size={14} />
            Raw Materials & Supplies
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchSummary();
              refetchItems();
              refetchMovements();
            }}
            className="border-border text-foreground hover:bg-muted text-xs h-9"
          >
            <RefreshCw size={14} className="mr-1.5" />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenAdjust(null, "stock_in")}
            className="bg-[#7B4E35] text-white hover:bg-[#633E2B] text-xs h-9 shadow-xs"
          >
            <Plus size={15} className="mr-1" />
            Stock In
          </Button>
        </div>
      </div>

      {/* Date Range & Global Filters */}
      <Card className="border-border/80 shadow-2xs bg-card/60 backdrop-blur-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Date Preset Buttons */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60 text-xs">
              {(
                [
                  { key: "today", label: "Today" },
                  { key: "yesterday", label: "Yesterday" },
                  { key: "7d", label: "Last 7 Days" },
                  { key: "30d", label: "Last 30 Days" },
                  { key: "all", label: "All Time" },
                  { key: "custom", label: "Custom" },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setDatePreset(preset.key)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    datePreset === preset.key
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers (visible when custom selected) */}
            {datePreset === "custom" && (
              <div className="flex items-center gap-2 text-xs">
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-8 text-xs w-36"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-8 text-xs w-36"
                />
              </div>
            )}

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <select
                value={selectedCategoryId || ""}
                onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#7B4E35]"
              >
                <option value="">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#7B4E35]"
              >
                <option value="all">All Items</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock Alerts</option>
                <option value="out_of_stock">Out of Stock</option>
                <option value="tracked">Tracked Only</option>
                <option value="untracked">Untracked Only</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Stock On Hand */}
        <Card className="border-border/80 shadow-2xs hover:shadow-xs transition-shadow">
          <CardHeader className="pb-2 pt-4 px-4 sm:px-5 flex flex-row items-center justify-between">
            <CardDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Stock on Hand
            </CardDescription>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 flex items-center justify-center">
              <Package size={16} />
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-5 pb-4">
            {summary?.stockOnHandByUnit && summary.stockOnHandByUnit.length > 0 ? (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {summary.stockOnHandByUnit.map((item, idx) => (
                  <span key={item.unit} className="inline-flex items-baseline">
                    <span className="text-xl sm:text-2xl font-serif font-bold text-foreground">
                      {item.quantity.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1 font-medium">
                      {item.unit}
                    </span>
                    {idx < summary.stockOnHandByUnit!.length - 1 && (
                      <span className="text-muted-foreground/40 ml-2 font-normal">·</span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-2xl sm:text-3xl font-serif font-bold text-foreground">
                {summary ? "0" : "..."}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Across <strong className="text-foreground">{summary?.totalTrackedItems ?? 0}</strong> tracked menu items
            </p>
          </CardContent>
        </Card>

        {/* Stock In (Period) */}
        <Card className="border-border/80 shadow-2xs hover:shadow-xs transition-shadow">
          <CardHeader className="pb-2 pt-4 px-4 sm:px-5 flex flex-row items-center justify-between">
            <CardDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Stock In (Period)
            </CardDescription>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 flex items-center justify-center">
              <ArrowDownLeft size={16} />
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-5 pb-4">
            {summary?.stockInByUnit && summary.stockInByUnit.length > 0 ? (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {summary.stockInByUnit.map((item, idx) => (
                  <span key={item.unit} className="inline-flex items-baseline">
                    <span className="text-xl sm:text-2xl font-serif font-bold text-blue-700 dark:text-blue-400">
                      +{item.quantity.toLocaleString()}
                    </span>
                    <span className="text-xs text-blue-600/70 dark:text-blue-300 ml-1 font-medium">
                      {item.unit}
                    </span>
                    {idx < summary.stockInByUnit!.length - 1 && (
                      <span className="text-blue-400/40 ml-2 font-normal">·</span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-2xl sm:text-3xl font-serif font-bold text-blue-700 dark:text-blue-400">
                {summary ? "+0" : "..."}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Restocks & opening stock added
            </p>
          </CardContent>
        </Card>

        {/* Stock Out (Period) */}
        <Card className="border-border/80 shadow-2xs hover:shadow-xs transition-shadow">
          <CardHeader className="pb-2 pt-4 px-4 sm:px-5 flex flex-row items-center justify-between">
            <CardDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Stock Out (Period)
            </CardDescription>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 flex items-center justify-center">
              <ArrowUpRight size={16} />
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-5 pb-4">
            {summary?.stockOutByUnit && summary.stockOutByUnit.length > 0 ? (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {summary.stockOutByUnit.map((item, idx) => (
                  <span key={item.unit} className="inline-flex items-baseline">
                    <span className="text-xl sm:text-2xl font-serif font-bold text-amber-700 dark:text-amber-400">
                      -{item.quantity.toLocaleString()}
                    </span>
                    <span className="text-xs text-amber-600/70 dark:text-amber-300 ml-1 font-medium">
                      {item.unit}
                    </span>
                    {idx < summary.stockOutByUnit!.length - 1 && (
                      <span className="text-amber-400/40 ml-2 font-normal">·</span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-2xl sm:text-3xl font-serif font-bold text-amber-700 dark:text-amber-400">
                {summary ? "0" : "..."}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Orders consumed & adjustments
            </p>
          </CardContent>
        </Card>

        {/* Alerts: Low Stock & Out of Stock */}
        <Card
          className={`border-border/80 shadow-2xs hover:shadow-xs transition-shadow ${
            (summary?.outOfStockCount || 0) > 0
              ? "border-rose-300 dark:border-rose-900 bg-rose-50/20"
              : (summary?.lowStockCount || 0) > 0
                ? "border-amber-300 dark:border-amber-900 bg-amber-50/20"
                : ""
          }`}
        >
          <CardHeader className="pb-2 pt-4 px-4 sm:px-5 flex flex-row items-center justify-between">
            <CardDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Stock Alerts
            </CardDescription>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 flex items-center justify-center">
              <AlertTriangle size={16} />
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-5 pb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-serif font-bold text-rose-600 dark:text-rose-400">
                {summary?.outOfStockCount ?? 0}
              </span>
              <span className="text-xs text-rose-600 font-semibold">Out</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-2xl sm:text-3xl font-serif font-bold text-amber-600 dark:text-amber-400">
                {summary?.lowStockCount ?? 0}
              </span>
              <span className="text-xs text-amber-600 font-semibold">Low</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Items requiring replenishment
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Stock Alert Banner (if any alert items exist) */}
      {summary && summary.alerts && summary.alerts.length > 0 && (
        <Card className="border-amber-300/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900 shadow-2xs">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 flex-shrink-0 mt-0.5">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">
                  {summary.alerts.length} Item{summary.alerts.length > 1 ? "s" : ""} Below Threshold
                </h4>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {summary.alerts.map((al) => (
                    <span
                      key={al.id}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                        al.alertType === "out_of_stock"
                          ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300"
                          : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      <span>{al.name}</span>
                      <span className="font-bold">
                        ({al.inventoryQuantity} {al.inventoryUnit})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const firstAlert = items.find((i) => i.id === summary.alerts[0]?.id);
                if (firstAlert) handleOpenAdjust(firstAlert, "stock_in");
              }}
              className="border-amber-400 text-amber-900 dark:text-amber-200 hover:bg-amber-100 text-xs flex-shrink-0"
            >
              Restock Item
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <TabsList className="bg-muted/80 p-1 rounded-xl">
            <TabsTrigger value="items" className="text-xs font-semibold px-4">
              <Package size={14} className="mr-1.5" />
              Stock on Hand ({items.length})
            </TabsTrigger>
            <TabsTrigger value="movements" className="text-xs font-semibold px-4">
              <History size={14} className="mr-1.5" />
              Movement History ({movements.length})
            </TabsTrigger>
          </TabsList>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 bg-background"
            />
          </div>
        </div>

        {/* TAB 1: MENU ITEMS STOCK TABLE */}
        <TabsContent value="items" className="mt-0">
          <Card className="border-border/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Menu Item</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Tracking</th>
                    <th className="py-3 px-3">Stock on Hand</th>
                    <th className="py-3 px-3">Threshold</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {isItemsLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        Loading inventory items...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        No menu items found matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const isTracked = Boolean(item.trackInventory);
                      const qty = Number(item.inventoryQuantity || 0);
                      const threshold = Number(item.lowStockThreshold || 5);
                      const unit = item.inventoryUnit || "portions";

                      let statusBadge = (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
                          Untracked
                        </Badge>
                      );

                      if (isTracked) {
                        if (qty <= 0) {
                          statusBadge = (
                            <Badge className="text-[10px] bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300">
                              Out of Stock
                            </Badge>
                          );
                        } else if (qty <= threshold) {
                          statusBadge = (
                            <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300">
                              Low Stock ({qty})
                            </Badge>
                          );
                        } else {
                          statusBadge = (
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                              In Stock
                            </Badge>
                          );
                        }
                      }

                      return (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-foreground">{item.name}</div>
                            <div className="text-[11px] text-muted-foreground">₹{Number(item.price).toFixed(2)}</div>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground">
                            {item.categoryName || "General"}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                                isTracked ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
                              }`}
                            >
                              {isTracked ? (
                                <>
                                  <CheckCircle2 size={12} /> Tracked
                                </>
                              ) : (
                                <>
                                  <HelpCircle size={12} /> Untracked
                                </>
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {isTracked ? (
                              <div className="font-mono font-bold text-sm text-foreground">
                                {qty} <span className="text-[11px] font-normal text-muted-foreground">{unit}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">Always Available</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-muted-foreground font-mono">
                            {isTracked ? `${threshold} ${unit}` : "-"}
                          </td>
                          <td className="py-3 px-3">{statusBadge}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Stock In Button */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenAdjust(item, "stock_in")}
                                className="h-7 px-2 text-[11px] text-blue-700 border-blue-200 hover:bg-blue-50 dark:border-blue-900"
                                title="Add Stock"
                              >
                                <Plus size={12} className="mr-0.5" /> In
                              </Button>

                              {/* Stock Out Button */}
                              {isTracked && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenAdjust(item, "stock_out")}
                                  disabled={qty <= 0}
                                  className="h-7 px-2 text-[11px] text-amber-700 border-amber-200 hover:bg-amber-50 dark:border-amber-900 disabled:opacity-40"
                                  title="Deduct Stock"
                                >
                                  <Minus size={12} className="mr-0.5" /> Out
                                </Button>
                              )}

                              {/* View Item Movements */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedMenuItemId(item.id);
                                  setActiveTab("movements");
                                }}
                                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                                title="View Movement History"
                              >
                                <History size={13} />
                              </Button>

                              {/* Item Inventory Settings */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenSettings(item)}
                                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                                title="Configure Inventory Tracking"
                              >
                                <Settings2 size={13} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 2: MOVEMENT HISTORY & AUDIT TRAIL */}
        <TabsContent value="movements" className="mt-0">
          <Card className="border-border/80 shadow-2xs overflow-hidden">
            <div className="p-3 bg-muted/30 border-b border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <History size={14} />
                <span>
                  Showing movement audit trail
                  {selectedMenuItemId && (
                    <span>
                      {" "}for{" "}
                      <strong className="text-foreground">
                        {items.find((i) => i.id === selectedMenuItemId)?.name}
                      </strong>
                    </span>
                  )}
                </span>
              </div>
              {selectedMenuItemId && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedMenuItemId(null)}
                  className="h-6 text-[11px] text-primary hover:underline"
                >
                  Clear Item Filter (Show All)
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-3">Menu Item</th>
                    <th className="py-3 px-3">Movement Type</th>
                    <th className="py-3 px-3">Qty Change</th>
                    <th className="py-3 px-3">Balance After</th>
                    <th className="py-3 px-3">Reason / Reference</th>
                    <th className="py-3 px-4 text-right">Performed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {isMovementsLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        Loading movement history...
                      </td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        No inventory movements recorded for the selected period.
                      </td>
                    </tr>
                  ) : (
                    movements.map((mov) => {
                      const isPositive =
                        mov.movementType === "stock_in" ||
                        mov.movementType === "opening_stock" ||
                        mov.movementType === "order_reversal";

                      const typeLabels: Record<string, { label: string; badgeClass: string }> = {
                        stock_in: {
                          label: "Stock In",
                          badgeClass: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300",
                        },
                        stock_out: {
                          label: "Stock Out",
                          badgeClass: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
                        },
                        order_deduction: {
                          label: "Order Deduction",
                          badgeClass: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300",
                        },
                        order_reversal: {
                          label: "Order Reversal",
                          badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
                        },
                        opening_stock: {
                          label: "Opening Stock",
                          badgeClass: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300",
                        },
                        adjustment: {
                          label: "Direct Adjustment",
                          badgeClass: "bg-stone-100 text-stone-800 border-stone-200 dark:bg-stone-900 dark:text-stone-300",
                        },
                      };

                      const meta = typeLabels[mov.movementType] || {
                        label: mov.movementType,
                        badgeClass: "bg-muted text-muted-foreground",
                      };

                      return (
                        <tr key={mov.id} className="hover:bg-muted/30 transition-colors font-mono">
                          <td className="py-3 px-4 font-sans text-muted-foreground whitespace-nowrap">
                            {new Date(mov.createdAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3 px-3 font-sans">
                            <span className="font-semibold text-foreground">{mov.menuItemName}</span>
                            {mov.categoryName && (
                              <span className="text-[10px] text-muted-foreground block">{mov.categoryName}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-sans">
                            <Badge className={`text-[10px] font-semibold border ${meta.badgeClass}`}>
                              {meta.label}
                            </Badge>
                          </td>
                          <td
                            className={`py-3 px-3 font-bold ${
                              isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {isPositive ? "+" : "-"}
                            {mov.quantity} <span className="text-[10px] font-normal text-muted-foreground">{mov.unit}</span>
                          </td>
                          <td className="py-3 px-3 font-bold text-foreground">
                            {mov.balanceAfter} <span className="text-[10px] font-normal text-muted-foreground">{mov.unit}</span>
                          </td>
                          <td className="py-3 px-3 font-sans text-muted-foreground">
                            {mov.reason || (mov.orderId ? `Order #${mov.orderId}` : "Manual adjustment")}
                          </td>
                          <td className="py-3 px-4 text-right font-sans text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <User size={11} /> {mov.performedBy || "admin"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: RECORD STOCK IN / STOCK OUT */}
      <Dialog open={adjustModalOpen} onOpenChange={setAdjustModalOpen}>
        <DialogContent className="sm:max-w-[440px] bg-card border-border">
          <form onSubmit={handleSubmitAdjust} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-serif">
                {adjustType === "stock_in" ? (
                  <>
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Plus size={16} />
                    </div>
                    Record Stock In / Restock
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                      <Minus size={16} />
                    </div>
                    Record Stock Out / Shortage
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {adjustType === "stock_in"
                  ? "Add received inventory or newly prepared items to current stock on hand."
                  : "Deduct spoiled, spilled, expired, or manually adjusted stock."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2 text-xs">
              {/* Menu Item Selector */}
              <div>
                <Label className="text-xs font-semibold">Menu Item *</Label>
                <select
                  value={adjustItem?.id || ""}
                  onChange={(e) => {
                    const selId = Number(e.target.value);
                    const found =
                      allMenuItems.find((i) => i.id === selId) ||
                      items.find((i) => i.id === selId);
                    if (found) {
                      setAdjustItem(found);
                      setAdjustUnit(found.inventoryUnit || "portions");
                    }
                  }}
                  className="w-full mt-1.5 h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#7B4E35]"
                >
                  {(allMenuItems.length > 0 ? allMenuItems : items).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Current: {i.trackInventory ? `${i.inventoryQuantity} ${i.inventoryUnit}` : "Untracked"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">
                    Quantity {adjustType === "stock_in" ? "to Add" : "to Deduct"} *
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="e.g. 10"
                    required
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    className="mt-1.5 text-xs h-9"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Unit</Label>
                  <Input
                    type="text"
                    placeholder="e.g. portions, cups, pcs"
                    value={adjustUnit}
                    onChange={(e) => setAdjustUnit(e.target.value)}
                    className="mt-1.5 text-xs h-9"
                  />
                </div>
              </div>

              {/* Reason / Note */}
              <div>
                <Label className="text-xs font-semibold">Reason / Audit Note</Label>
                <Input
                  type="text"
                  placeholder={
                    adjustType === "stock_in"
                      ? "e.g. Supplier delivery, morning prep"
                      : "e.g. Spillage, damaged batch, count correction"
                  }
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="mt-1.5 text-xs h-9"
                />
              </div>

              {/* Date & Time */}
              <div>
                <Label className="text-xs font-semibold">Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={adjustDate}
                  onChange={(e) => setAdjustDate(e.target.value)}
                  className="mt-1.5 text-xs h-9"
                />
              </div>

              {/* Current balance preview */}
              {adjustItem && (
                <div className="p-3 rounded-xl bg-muted/40 border border-border/80 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Projected New Balance:</span>
                  <span className="font-mono font-bold text-foreground">
                    {adjustType === "stock_in"
                      ? Number(adjustItem.inventoryQuantity || 0) + (parseFloat(adjustQty) || 0)
                      : Math.max(0, Number(adjustItem.inventoryQuantity || 0) - (parseFloat(adjustQty) || 0))}{" "}
                    {adjustUnit}
                  </span>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAdjustModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingAdjust || !adjustQty}
                className="bg-[#7B4E35] text-white hover:bg-[#633E2B] text-xs"
              >
                {isSubmittingAdjust ? "Saving..." : "Confirm Movement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: ITEM INVENTORY TRACKING SETTINGS */}
      <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
        <DialogContent className="sm:max-w-[440px] bg-card border-border">
          <form onSubmit={handleSubmitSettings} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-serif">
                <Settings2 size={18} className="text-[#7B4E35]" />
                Inventory Tracking: {settingsItem?.name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure whether this menu item tracks stock quantities, unit, and alert thresholds.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2 text-xs">
              {/* Enable / Disable Tracking Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold text-foreground">Track Stock for this Item</Label>
                  <p className="text-[11px] text-muted-foreground">
                    When disabled, item remains untracked and always available.
                  </p>
                </div>
                <Switch checked={settingsTrack} onCheckedChange={setSettingsTrack} />
              </div>

              {settingsTrack && (
                <>
                  {/* Current / Opening Quantity */}
                  <div>
                    <Label className="text-xs font-semibold">Opening / Current Stock Quantity</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={settingsQty}
                      onChange={(e) => setSettingsQty(e.target.value)}
                      className="mt-1.5 text-xs h-9"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Sets the baseline opening stock. Automatically logged in the audit trail.
                    </p>
                  </div>

                  {/* Unit & Threshold */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Unit of Measurement</Label>
                      <Input
                        type="text"
                        placeholder="e.g. portions, cups, pcs"
                        value={settingsUnit}
                        onChange={(e) => setSettingsUnit(e.target.value)}
                        className="mt-1.5 text-xs h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Low-Stock Alert Level</Label>
                      <Input
                        type="number"
                        min="0"
                        value={settingsThreshold}
                        onChange={(e) => setSettingsThreshold(e.target.value)}
                        className="mt-1.5 text-xs h-9"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSettingsModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingSettings}
                className="bg-[#7B4E35] text-white hover:bg-[#633E2B] text-xs"
              >
                {isSubmittingSettings ? "Saving..." : "Save Settings"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

