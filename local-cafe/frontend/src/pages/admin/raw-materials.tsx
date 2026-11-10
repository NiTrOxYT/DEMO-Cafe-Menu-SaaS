import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  Plus,
  Minus,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  Download,
  RefreshCw,
  Edit2,
  Calendar,
  UtensilsCrossed,
  ChefHat,
  Trash2,
  Archive,
  RotateCcw,
  CheckCircle2,
  DollarSign,
  Layers,
  ArrowLeft,
} from "lucide-react";
import {
  useGetMe,
  useRawMaterials,
  useRawMaterialsSummary,
  useRawMaterialMovements,
  useRecipes,
  createRawMaterial,
  updateRawMaterial,
  archiveRawMaterial,
  restoreRawMaterial,
  recordRawMaterialMovement,
  saveRecipeForMenuItem,
  RawMaterial,
  RawMaterialMovement,
  RecipeIngredient,
  MenuItemRecipeItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const RAW_MATERIAL_CATEGORIES = [
  "Meat & Poultry",
  "Dairy & Cheese",
  "Fresh Produce",
  "Coffee & Tea",
  "Bakery & Flour",
  "Dry Goods & Spices",
  "Packaging & Disposables",
  "Cleaning & Supplies",
  "Beverage Syrups",
  "Other",
];

const PREDEFINED_UNITS = [
  { value: "kg", label: "Kilograms (kg)", dim: "mass" },
  { value: "g", label: "Grams (g)", dim: "mass" },
  { value: "litres", label: "Litres (l)", dim: "volume" },
  { value: "ml", label: "Millilitres (ml)", dim: "volume" },
  { value: "pieces", label: "Pieces (pcs)", dim: "discrete" },
  { value: "packs", label: "Packs / Packets", dim: "discrete" },
  { value: "portions", label: "Portions", dim: "discrete" },
];

export default function RawMaterialsDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Auth Guard
  const { data: admin, isLoading: isAuthLoading } = useGetMe();

  // Filter States
  const [datePreset, setDatePreset] = useState<"today" | "yesterday" | "7d" | "30d" | "all" | "custom">("7d");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"catalog" | "movements" | "recipes">("catalog");

  // Modals state
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RawMaterial | null>(null);

  // Item Form Fields
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Meat & Poultry");
  const [formSku, setFormSku] = useState("");
  const [formBaseUnit, setFormBaseUnit] = useState("kg");
  const [formOpeningStock, setFormOpeningStock] = useState("");
  const [formThreshold, setFormThreshold] = useState("2");
  const [formSupplier, setFormSupplier] = useState("");
  const [formUnitCost, setFormUnitCost] = useState("");
  const [formBatchNumber, setFormBatchNumber] = useState("");
  const [formExpiryDate, setFormExpiryDate] = useState("");
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);

  // Stock Movement Modal State
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<"stock_in" | "stock_out" | "adjustment">("stock_in");
  const [movItem, setMovItem] = useState<RawMaterial | null>(null);
  const [movQty, setMovQty] = useState("");
  const [movUnit, setMovUnit] = useState("kg");
  const [movReason, setMovReason] = useState("");
  const [movSupplier, setMovSupplier] = useState("");
  const [movInvoiceRef, setMovInvoiceRef] = useState("");
  const [movUnitCost, setMovUnitCost] = useState("");
  const [movBatchNumber, setMovBatchNumber] = useState("");
  const [movExpiryDate, setMovExpiryDate] = useState("");
  const [movDate, setMovDate] = useState("");
  const [isSubmittingMov, setIsSubmittingMov] = useState(false);

  // Recipe Modal State
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItemRecipeItem | null>(null);
  const [recipeIngredients, setRecipeIngredients] = useState<
    Array<{ rawMaterialId: number; quantity: number; unit: string; notes: string }>
  >([]);
  const [isSubmittingRecipe, setIsSubmittingRecipe] = useState(false);

  // Date Range Calculation
  const { startDateStr, endDateStr } = useMemo(() => {
    const now = new Date();
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
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
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
  const {
    data: summary,
    refetch: refetchSummary,
    isLoading: isSummaryLoading,
  } = useRawMaterialsSummary({
    startDate: startDateStr,
    endDate: endDateStr,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    supplier: supplierFilter !== "all" ? supplierFilter : undefined,
  });

  const {
    data: rawMaterials = [],
    refetch: refetchMaterials,
    isLoading: isMaterialsLoading,
  } = useRawMaterials({
    search: searchQuery || undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    supplier: supplierFilter !== "all" ? supplierFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  // Unfiltered items list for dropdown selects
  const { data: allRawMaterials = [] } = useRawMaterials();

  const {
    data: movementsData,
    refetch: refetchMovements,
    isLoading: isMovementsLoading,
  } = useRawMaterialMovements({
    startDate: startDateStr,
    endDate: endDateStr,
    supplier: supplierFilter !== "all" ? supplierFilter : undefined,
    search: searchQuery || undefined,
    limit: 150,
  });

  const movements = movementsData?.movements || [];

  const { data: recipes = [], refetch: refetchRecipes, isLoading: isRecipesLoading } = useRecipes();

  // Distinct suppliers for filter dropdown
  const suppliersList = useMemo(() => {
    const set = new Set<string>();
    for (const m of allRawMaterials) {
      if (m.supplier && m.supplier.trim()) set.add(m.supplier.trim());
    }
    return Array.from(set).sort();
  }, [allRawMaterials]);

  // Handler: Open Add Raw Material Modal
  const handleOpenCreateItem = () => {
    setIsEditingItem(false);
    setSelectedItem(null);
    setFormName("");
    setFormCategory("Meat & Poultry");
    setFormSku("");
    setFormBaseUnit("kg");
    setFormOpeningStock("");
    setFormThreshold("2");
    setFormSupplier("");
    setFormUnitCost("");
    setFormBatchNumber("");
    setFormExpiryDate("");
    setItemModalOpen(true);
  };

  // Handler: Open Edit Raw Material Modal
  const handleOpenEditItem = (item: RawMaterial) => {
    setIsEditingItem(true);
    setSelectedItem(item);
    setFormName(item.name);
    setFormCategory(item.category || "Meat & Poultry");
    setFormSku(item.sku || "");
    setFormBaseUnit(item.baseUnit || "kg");
    setFormOpeningStock(String(item.currentStock));
    setFormThreshold(String(item.lowStockThreshold));
    setFormSupplier(item.supplier || "");
    setFormUnitCost(item.unitCost !== null && item.unitCost !== undefined ? String(item.unitCost) : "");
    setFormBatchNumber(item.batchNumber || "");
    setFormExpiryDate(item.expiryDate ? item.expiryDate.substring(0, 10) : "");
    setItemModalOpen(true);
  };

  // Handler: Submit Item Form
  const handleSubmitItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast({ title: "Name required", description: "Please enter an item name.", variant: "destructive" });
      return;
    }

    try {
      setIsSubmittingItem(true);
      if (isEditingItem && selectedItem) {
        await updateRawMaterial(selectedItem.id, {
          name: formName.trim(),
          category: formCategory.trim(),
          sku: formSku.trim() || undefined,
          baseUnit: formBaseUnit,
          lowStockThreshold: parseFloat(formThreshold) || 0,
          supplier: formSupplier.trim() || undefined,
          unitCost: formUnitCost ? parseFloat(formUnitCost) : null,
          batchNumber: formBatchNumber.trim() || undefined,
          expiryDate: formExpiryDate || null,
        });
        toast({ title: "Item Updated", description: `Updated ${formName}.` });
      } else {
        await createRawMaterial({
          name: formName.trim(),
          category: formCategory.trim(),
          sku: formSku.trim() || undefined,
          baseUnit: formBaseUnit,
          currentStock: formOpeningStock ? parseFloat(formOpeningStock) : 0,
          lowStockThreshold: parseFloat(formThreshold) || 2,
          supplier: formSupplier.trim() || undefined,
          unitCost: formUnitCost ? parseFloat(formUnitCost) : undefined,
          batchNumber: formBatchNumber.trim() || undefined,
          expiryDate: formExpiryDate || undefined,
        });
        toast({ title: "Raw Material Created", description: `Added ${formName} to inventory.` });
      }

      setItemModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      refetchSummary();
      refetchMaterials();
    } catch (err: any) {
      toast({ title: "Failed to save item", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingItem(false);
    }
  };

  // Handler: Archive Item (Soft-delete: preserves immutable audit movement log and history)
  const handleArchive = async (item: RawMaterial) => {
    if (!confirm(`Are you sure you want to archive "${item.name}"? This hides the material from active inventory while preserving all immutable audit history.`)) return;
    try {
      await archiveRawMaterial(item.id);
      toast({ title: "Item Archived", description: `${item.name} has been archived. All audit records preserved.` });
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      refetchMaterials();
      refetchSummary();
    } catch (err: any) {
      toast({ title: "Failed to archive", description: err.message, variant: "destructive" });
    }
  };

  // Handler: Restore Archived Item
  const handleRestore = async (item: RawMaterial) => {
    try {
      await restoreRawMaterial(item.id);
      toast({ title: "Item Restored", description: `${item.name} has been restored to active inventory.` });
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      refetchMaterials();
      refetchSummary();
    } catch (err: any) {
      toast({ title: "Failed to restore", description: err.message, variant: "destructive" });
    }
  };

  // Handler: Open Movement Modal
  const handleOpenMovement = (item?: RawMaterial | null, type: "stock_in" | "stock_out" | "adjustment" = "stock_in") => {
    const target = item || allRawMaterials[0] || rawMaterials[0] || null;
    setMovItem(target);
    setMovementType(type);
    setMovQty("");
    setMovUnit(target?.baseUnit || "kg");
    setMovReason(
      type === "stock_in"
        ? "Supplier delivery"
        : type === "stock_out"
        ? "Kitchen prep use"
        : "Periodic count adjustment"
    );
    setMovSupplier(target?.supplier || "");
    setMovInvoiceRef("");
    setMovUnitCost(target?.unitCost !== null && target?.unitCost !== undefined ? String(target?.unitCost) : "");
    setMovBatchNumber(target?.batchNumber || "");
    setMovExpiryDate(target?.expiryDate ? target.expiryDate.substring(0, 10) : "");
    setMovDate(new Date().toISOString().substring(0, 16));
    setMovementModalOpen(true);
  };

  // Handler: Submit Movement
  const handleSubmitMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movItem) {
      toast({ title: "Item Required", description: "Please select an item.", variant: "destructive" });
      return;
    }

    const qty = parseFloat(movQty);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Invalid Quantity", description: "Quantity must be > 0.", variant: "destructive" });
      return;
    }

    if ((movementType === "stock_out" || movementType === "adjustment") && !movReason.trim()) {
      toast({ title: "Reason Required", description: "A reason is mandatory for Stock Out and Adjustment.", variant: "destructive" });
      return;
    }

    try {
      setIsSubmittingMov(true);
      await recordRawMaterialMovement(movItem.id, {
        movementType,
        quantity: qty,
        unit: movUnit,
        reason: movReason.trim(),
        supplier: movSupplier.trim() || undefined,
        invoiceRef: movInvoiceRef.trim() || undefined,
        unitCost: movUnitCost ? parseFloat(movUnitCost) : undefined,
        batchNumber: movBatchNumber.trim() || undefined,
        expiryDate: movExpiryDate || undefined,
        date: movDate ? new Date(movDate).toISOString() : undefined,
      });

      toast({
        title: movementType === "stock_in" ? "Stock In Received" : movementType === "stock_out" ? "Stock Out Recorded" : "Adjustment Saved",
        description: `${qty} ${movUnit} recorded for ${movItem.name}.`,
      });

      setMovementModalOpen(false);
      setMovQty("");
      setMovReason("");
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      refetchSummary();
      refetchMaterials();
      refetchMovements();
    } catch (err: any) {
      toast({ title: "Movement Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingMov(false);
    }
  };

  // Handler: Open Recipe Editor Modal
  const handleOpenRecipeModal = (menuItem: MenuItemRecipeItem) => {
    setSelectedMenuItem(menuItem);
    setRecipeIngredients(
      menuItem.ingredients.map((ing) => ({
        rawMaterialId: ing.rawMaterialId,
        quantity: ing.quantity,
        unit: ing.unit,
        notes: ing.notes || "",
      }))
    );
    setRecipeModalOpen(true);
  };

  // Handler: Add Ingredient row to recipe
  const handleAddIngredientRow = () => {
    const firstRm = allRawMaterials[0];
    if (!firstRm) {
      toast({ title: "No Raw Materials", description: "Add raw materials first.", variant: "destructive" });
      return;
    }
    setRecipeIngredients([
      ...recipeIngredients,
      { rawMaterialId: firstRm.id, quantity: 1, unit: firstRm.baseUnit, notes: "" },
    ]);
  };

  // Handler: Remove Ingredient row
  const handleRemoveIngredientRow = (idx: number) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx));
  };

  // Handler: Save Recipe
  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenuItem) return;

    try {
      setIsSubmittingRecipe(true);
      await saveRecipeForMenuItem(selectedMenuItem.menuItemId, recipeIngredients);
      toast({
        title: "Recipe Saved",
        description: `Recipe for ${selectedMenuItem.menuItemName} updated with ${recipeIngredients.length} ingredients.`,
      });
      setRecipeModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["raw-materials", "recipes"] });
      refetchRecipes();
    } catch (err: any) {
      toast({ title: "Failed to Save Recipe", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingRecipe(false);
    }
  };

  // CSV Export URL
  const handleDownloadCsv = () => {
    const params = new URLSearchParams();
    if (startDateStr) params.set("startDate", startDateStr);
    if (endDateStr) params.set("endDate", endDateStr);
    window.location.href = `/api/raw-materials/movements/export-csv?${params.toString()}`;
  };

  if (!isAuthLoading && !admin) {
    setLocation("/admin/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Top Header Bar */}
      <header className="border-b border-border/80 bg-card/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/admin")}
              className="text-muted-foreground hover:text-foreground text-xs gap-1.5 h-8 -ml-2"
            >
              <ArrowLeft size={14} /> Back to Admin
            </Button>
            <div className="h-4 w-px bg-border" />
            <div>
              <div className="flex items-center gap-2">
                <Boxes size={18} className="text-[#7B4E35]" />
                <h1 className="text-base sm:text-lg font-serif font-bold text-foreground leading-none">
                  Raw Materials & Supplies
                </h1>
              </div>
              <p className="text-[11px] text-muted-foreground">Kusum Kunja Café · Supply & Ingredients Ledger</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCsv}
              className="text-xs h-8 gap-1 border-border"
              title="Download Movement Audit Trail"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>

            <Button
              size="sm"
              onClick={() => handleOpenMovement(null, "stock_in")}
              className="bg-emerald-700 text-white hover:bg-emerald-800 text-xs h-8 shadow-2xs gap-1"
            >
              <ArrowDownLeft size={14} />
              <span>Stock In</span>
            </Button>

            <Button
              size="sm"
              onClick={handleOpenCreateItem}
              className="bg-[#7B4E35] text-white hover:bg-[#633E2B] text-xs h-8 shadow-2xs gap-1"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">New Item</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Date Presets & Filter Controls */}
        <Card className="border-border/80 shadow-2xs bg-card/60">
          <CardContent className="p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Date Presets */}
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
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      datePreset === preset.key
                        ? "bg-card text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Refresh Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  refetchSummary();
                  refetchMaterials();
                  refetchMovements();
                  refetchRecipes();
                }}
                className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              >
                <RefreshCw size={13} />
                Refresh
              </Button>
            </div>

            {/* Custom Date Pickers */}
            {datePreset === "custom" && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="text-muted-foreground">From:</span>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
                <span className="text-muted-foreground">To:</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
          {/* Card 1: Total Items & Value */}
          <Card className="border-border/80 shadow-2xs hover:shadow-xs transition-shadow">
            <CardHeader className="pb-2 pt-4 px-4 sm:px-5 flex flex-row items-center justify-between">
              <CardDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Raw Materials Stock
              </CardDescription>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 flex items-center justify-center">
                <Boxes size={16} />
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-5 pb-4">
              <div className="text-2xl sm:text-3xl font-serif font-bold text-foreground">
                {summary ? summary.totalItems : "..."}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {summary && summary.totalInventoryValue > 0 ? (
                  <>
                    Estimated Value:{" "}
                    <strong className="text-foreground">₹{summary.totalInventoryValue.toLocaleString()}</strong>
                  </>
                ) : (
                  "Across all material categories"
                )}
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Stock on Hand (Grouped by Unit) */}
          <Card className="border-border/80 shadow-2xs hover:shadow-xs transition-shadow">
            <CardHeader className="pb-2 pt-4 px-4 sm:px-5 flex flex-row items-center justify-between">
              <CardDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Stock on Hand
              </CardDescription>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 flex items-center justify-center">
                <Layers size={16} />
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-5 pb-4">
              {summary?.stockByUnit && summary.stockByUnit.length > 0 ? (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  {summary.stockByUnit.map((item, idx) => (
                    <span key={item.unit} className="inline-flex items-baseline">
                      <span className="text-lg sm:text-xl font-serif font-bold text-foreground">
                        {item.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1 font-medium">{item.unit}</span>
                      {idx < summary.stockByUnit.length - 1 && (
                        <span className="text-muted-foreground/40 ml-2">·</span>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-2xl font-serif font-bold text-foreground">{summary ? "0" : "..."}</div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1.5">Categorized by physical base unit</p>
            </CardContent>
          </Card>

          {/* Card 3: Stock In (Period) */}
          <Card className="border-border/80 shadow-2xs hover:shadow-xs transition-shadow">
            <CardHeader className="pb-2 pt-4 px-4 sm:px-5 flex flex-row items-center justify-between">
              <CardDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Stock In (Period)
              </CardDescription>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 flex items-center justify-center">
                <ArrowDownLeft size={16} />
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-5 pb-4">
              {summary?.stockInByUnit && summary.stockInByUnit.length > 0 ? (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  {summary.stockInByUnit.map((item, idx) => (
                    <span key={item.unit} className="inline-flex items-baseline">
                      <span className="text-lg sm:text-xl font-serif font-bold text-emerald-700 dark:text-emerald-400">
                        +{item.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-emerald-600/70 ml-1 font-medium">{item.unit}</span>
                      {idx < summary.stockInByUnit.length - 1 && (
                        <span className="text-emerald-400/40 ml-2">·</span>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-2xl font-serif font-bold text-emerald-700 dark:text-emerald-400">
                  {summary ? "+0" : "..."}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1.5">Deliveries & restocks received</p>
            </CardContent>
          </Card>

          {/* Card 4: Stock Out (Period) */}
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
                      <span className="text-lg sm:text-xl font-serif font-bold text-amber-700 dark:text-amber-400">
                        -{item.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-amber-600/70 ml-1 font-medium">{item.unit}</span>
                      {idx < summary.stockOutByUnit.length - 1 && (
                        <span className="text-amber-400/40 ml-2">·</span>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-2xl font-serif font-bold text-amber-700 dark:text-amber-400">
                  {summary ? "0" : "..."}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1.5">Kitchen recipes & manual use</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Alerts Banner */}
        {summary && (summary.lowStockCount > 0 || summary.outOfStockCount > 0 || summary.expiringSoonCount > 0) && (
          <Card className="border-amber-300 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20 shadow-2xs">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                    Attention Required:{" "}
                    {summary.outOfStockCount > 0 && `${summary.outOfStockCount} Out of Stock · `}
                    {summary.lowStockCount > 0 && `${summary.lowStockCount} Low Stock · `}
                    {summary.expiringSoonCount > 0 && `${summary.expiringSoonCount} Expiring Soon`}
                  </h4>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                    {summary.alerts?.slice(0, 3).map((a) => a.name).join(", ")}
                    {(summary.alerts?.length || 0) > 3 ? "..." : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setStatusFilter("low_stock");
                    setActiveTab("catalog");
                  }}
                  className="h-7 text-xs border-amber-300 text-amber-900 hover:bg-amber-100/60"
                >
                  View Low Stock
                </Button>
                {summary.expiringSoonCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setStatusFilter("expiring_soon");
                      setActiveTab("catalog");
                    }}
                    className="h-7 text-xs border-amber-300 text-amber-900 hover:bg-amber-100/60"
                  >
                    View Expiring
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
          <TabsList className="bg-muted/70 p-1 rounded-xl border border-border/80 h-10">
            <TabsTrigger value="catalog" className="text-xs gap-1.5 data-[state=active]:bg-card">
              <Boxes size={14} />
              Raw Materials ({rawMaterials.length})
            </TabsTrigger>
            <TabsTrigger value="movements" className="text-xs gap-1.5 data-[state=active]:bg-card">
              <Clock size={14} />
              Movements & Audit History ({movements.length})
            </TabsTrigger>
            <TabsTrigger value="recipes" className="text-xs gap-1.5 data-[state=active]:bg-card">
              <ChefHat size={14} />
              Menu Item Recipes ({recipes.length})
            </TabsTrigger>
          </TabsList>

          {/* ==================================================== */}
          {/* TAB 1: RAW MATERIALS CATALOG                         */}
          {/* ==================================================== */}
          <TabsContent value="catalog" className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/80">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                {/* Search */}
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search material, SKU, supplier..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-8"
                  />
                </div>

                {/* Category Filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-xs h-8 rounded-lg border border-border bg-background px-2.5 text-foreground"
                >
                  <option value="all">All Categories</option>
                  {RAW_MATERIAL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {/* Supplier Filter */}
                {suppliersList.length > 0 && (
                  <select
                    value={supplierFilter}
                    onChange={(e) => setSupplierFilter(e.target.value)}
                    className="text-xs h-8 rounded-lg border border-border bg-background px-2.5 text-foreground"
                  >
                    <option value="all">All Suppliers</option>
                    {suppliersList.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs h-8 rounded-lg border border-border bg-background px-2.5 text-foreground"
                >
                  <option value="all">All Statuses</option>
                  <option value="in_stock">In Stock Only</option>
                  <option value="low_stock">Low Stock Alerts</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="expiring_soon">Expiring Soon (7d)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {(searchQuery || categoryFilter !== "all" || supplierFilter !== "all" || statusFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setCategoryFilter("all");
                    setSupplierFilter("all");
                    setStatusFilter("all");
                  }}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Catalog Table */}
            <Card className="border-border/80 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4 font-semibold">Material & SKU</th>
                      <th className="py-3 px-3 font-semibold">Category</th>
                      <th className="py-3 px-3 font-semibold text-right">Current Stock</th>
                      <th className="py-3 px-3 font-semibold text-right">Threshold</th>
                      <th className="py-3 px-3 font-semibold text-right">Cost / Value</th>
                      <th className="py-3 px-3 font-semibold">Batch & Expiry</th>
                      <th className="py-3 px-3 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {isMaterialsLoading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-muted-foreground">
                          Loading raw materials...
                        </td>
                      </tr>
                    ) : rawMaterials.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-muted-foreground space-y-2">
                          <p>No raw materials found matching your filters.</p>
                          <Button size="sm" onClick={handleOpenCreateItem} className="h-8 text-xs">
                            <Plus size={14} className="mr-1" /> Add Your First Raw Material
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      rawMaterials.map((item) => {
                        const stockNum = parseFloat(String(item.currentStock));
                        const threshNum = parseFloat(String(item.lowStockThreshold));
                        const isOut = stockNum <= 0;
                        const isLow = !isOut && stockNum <= threshNum;
                        const isExpiring = item.status === "expiring_soon";

                        return (
                          <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                            {/* Name & SKU */}
                            <td className="py-3 px-4">
                              <div className="font-semibold text-foreground">{item.name}</div>
                              <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                {item.sku && <span>SKU: {item.sku}</span>}
                                {item.supplier && <span>· Supplier: {item.supplier}</span>}
                                {item.recipeUsageCount ? (
                                  <span className="text-[#7B4E35] font-medium">
                                    · In {item.recipeUsageCount} recipes
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            {/* Category */}
                            <td className="py-3 px-3 text-muted-foreground">
                              <span className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium">
                                {item.category}
                              </span>
                            </td>

                            {/* Current Stock */}
                            <td className="py-3 px-3 text-right font-mono font-bold">
                              <span className={isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-foreground"}>
                                {stockNum.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                              </span>
                              <span className="text-muted-foreground ml-1 font-normal">{item.baseUnit}</span>
                            </td>

                            {/* Low Threshold */}
                            <td className="py-3 px-3 text-right text-muted-foreground font-mono">
                              {threshNum} {item.baseUnit}
                            </td>

                            {/* Unit Cost & Total Value */}
                            <td className="py-3 px-3 text-right">
                              {item.unitCost !== null && item.unitCost !== undefined ? (
                                <div>
                                  <div className="font-mono text-foreground">₹{item.unitCost}/{item.baseUnit}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono">
                                    Total: ₹{(stockNum * item.unitCost).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/60">-</span>
                              )}
                            </td>

                            {/* Batch & Expiry */}
                            <td className="py-3 px-3">
                              {item.expiryDate ? (
                                <div className="space-y-0.5">
                                  <span
                                    className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                      new Date(item.expiryDate) <= new Date()
                                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                        : isExpiring
                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    Exp: {new Date(item.expiryDate).toISOString().substring(0, 10)}
                                  </span>
                                  {item.batchNumber && (
                                    <div className="text-[10px] text-muted-foreground">Lot: {item.batchNumber}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground/60">-</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3">
                              {item.isArchived ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground">
                                  Archived
                                </span>
                              ) : isOut ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-medium">
                                  Out of Stock
                                </span>
                              ) : isLow ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-medium">
                                  Low Stock
                                </span>
                              ) : isExpiring ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-medium">
                                  Expiring Soon
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
                                  In Stock
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {item.isArchived ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRestore(item)}
                                    className="h-7 px-2.5 text-[11px] text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1"
                                    title="Restore Material to Active Inventory"
                                  >
                                    <RotateCcw size={11} /> Restore
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleOpenMovement(item, "stock_in")}
                                      className="h-7 px-2 text-[11px] text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                      title="Receive Goods / Stock In"
                                    >
                                      <Plus size={11} className="mr-0.5" /> In
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleOpenMovement(item, "stock_out")}
                                      disabled={stockNum <= 0}
                                      className="h-7 px-2 text-[11px] text-amber-700 border-amber-200 hover:bg-amber-50"
                                      title="Record Stock Out"
                                    >
                                      <Minus size={11} className="mr-0.5" /> Out
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleOpenEditItem(item)}
                                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                      title="Edit Item Details"
                                    >
                                      <Edit2 size={12} />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleArchive(item)}
                                      className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-700"
                                      title="Archive Material (Preserves Audit History)"
                                    >
                                      <Archive size={12} />
                                    </Button>
                                  </>
                                )}
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

          {/* ==================================================== */}
          {/* TAB 2: STOCK MOVEMENT LOG & AUDIT TRAIL              */}
          {/* ==================================================== */}
          <TabsContent value="movements" className="space-y-4">
            <Card className="border-border/80 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4 font-semibold">Date & Time</th>
                      <th className="py-3 px-3 font-semibold">Item & Category</th>
                      <th className="py-3 px-3 font-semibold">Type</th>
                      <th className="py-3 px-3 font-semibold text-right">Quantity</th>
                      <th className="py-3 px-3 font-semibold text-right">Before → After</th>
                      <th className="py-3 px-3 font-semibold">Supplier / Ref</th>
                      <th className="py-3 px-3 font-semibold">Reason / Order</th>
                      <th className="py-3 px-4 font-semibold text-right">Performed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {isMovementsLoading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-muted-foreground">
                          Loading movements audit log...
                        </td>
                      </tr>
                    ) : movements.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-muted-foreground">
                          No movements recorded for the selected period.
                        </td>
                      </tr>
                    ) : (
                      movements.map((mov) => {
                        const isIn =
                          mov.movementType === "stock_in" ||
                          mov.movementType === "opening_stock" ||
                          mov.movementType === "order_reversal";

                        const typeMap: Record<string, { label: string; cls: string }> = {
                          stock_in: { label: "Stock In", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
                          stock_out: { label: "Stock Out", cls: "bg-amber-100 text-amber-800 border-amber-200" },
                          adjustment: { label: "Adjustment", cls: "bg-blue-100 text-blue-800 border-blue-200" },
                          recipe_consumption: { label: "Recipe Consumption", cls: "bg-purple-100 text-purple-800 border-purple-200" },
                          order_reversal: { label: "Order Reversal", cls: "bg-teal-100 text-teal-800 border-teal-200" },
                          opening_stock: { label: "Opening Stock", cls: "bg-zinc-100 text-zinc-800 border-zinc-200" },
                        };

                        const meta = typeMap[mov.movementType] || { label: mov.movementType, cls: "bg-muted text-foreground" };

                        return (
                          <tr key={mov.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4 text-muted-foreground font-mono">
                              {new Date(mov.createdAt).toLocaleDateString()} {new Date(mov.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>

                            <td className="py-3 px-3">
                              <span className="font-semibold text-foreground">{mov.rawMaterialName}</span>
                              <span className="text-[10px] text-muted-foreground ml-1.5">({mov.category})</span>
                            </td>

                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${meta.cls}`}>
                                {meta.label}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-right font-mono font-bold">
                              <span className={isIn ? "text-emerald-700" : "text-amber-700"}>
                                {isIn ? "+" : "-"}
                                {parseFloat(String(mov.quantity)).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                              </span>{" "}
                              <span className="text-muted-foreground text-[10px] font-normal">{mov.unit}</span>
                            </td>

                            <td className="py-3 px-3 text-right font-mono text-muted-foreground text-[11px]">
                              {parseFloat(String(mov.balanceBefore))} →{" "}
                              <strong className="text-foreground">{parseFloat(String(mov.balanceAfter))}</strong> {mov.baseUnit}
                            </td>

                            <td className="py-3 px-3 text-muted-foreground">
                              {mov.supplier || mov.invoiceRef ? (
                                <div className="space-y-0.5">
                                  {mov.supplier && <div className="text-foreground">{mov.supplier}</div>}
                                  {mov.invoiceRef && <div className="text-[10px]">Ref: {mov.invoiceRef}</div>}
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>

                            <td className="py-3 px-3 text-muted-foreground max-w-[220px] truncate" title={mov.reason || ""}>
                              {mov.reason || (mov.orderId ? `Order #${mov.orderId}` : "-")}
                            </td>

                            <td className="py-3 px-4 text-right text-muted-foreground font-mono text-[11px]">
                              {mov.performedBy}
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

          {/* ==================================================== */}
          {/* TAB 3: MENU ITEM RECIPES MATRIX                      */}
          {/* ==================================================== */}
          <TabsContent value="recipes" className="space-y-4">
            <Card className="border-border/80 shadow-2xs p-4 bg-muted/20">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  <h3 className="font-serif font-bold text-sm text-foreground">Menu Item Ingredient Recipes</h3>
                  <p className="text-muted-foreground mt-0.5">
                    Configure ingredient formulas per serving. When an order is placed, raw materials will be automatically
                    deducted based strictly on these recipes. Unconfigured items will not deduct raw materials.
                  </p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {isRecipesLoading ? (
                <div className="col-span-full py-12 text-center text-muted-foreground text-xs">
                  Loading menu item recipes...
                </div>
              ) : recipes.length === 0 ? (
                <div className="col-span-full py-12 text-center text-muted-foreground text-xs">
                  No menu items found.
                </div>
              ) : (
                recipes.map((item) => (
                  <Card key={item.menuItemId} className="border-border/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-sm font-serif font-bold text-foreground">
                            {item.menuItemName}
                          </CardTitle>
                          <CardDescription className="text-[11px] text-muted-foreground mt-0.5">
                            {item.categoryName} · ₹{item.menuItemPrice}
                          </CardDescription>
                        </div>
                        {item.hasRecipe ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                            <CheckCircle2 size={11} /> Configured
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shrink-0">
                            No Recipe
                          </span>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="px-4 pb-4 space-y-3 flex-1 flex flex-col justify-between">
                      {item.hasRecipe ? (
                        <div className="space-y-1.5 pt-1 text-xs">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Ingredients Per Serving:
                          </p>
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                            {item.ingredients.map((ing) => (
                              <div
                                key={ing.id}
                                className="flex items-center justify-between py-1 px-2 rounded bg-muted/40 text-[11px]"
                              >
                                <span className="font-medium text-foreground truncate mr-2 flex items-center gap-1.5">
                                  {ing.rawMaterialName}
                                  {ing.isArchived && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-normal bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                      Archived
                                    </span>
                                  )}
                                </span>
                                <span className="font-mono text-muted-foreground shrink-0">
                                  {ing.quantity} {ing.unit}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-muted/30 border border-dashed border-border/80 text-[11px] text-muted-foreground text-center my-2">
                          Orders for this item will not consume raw materials until a recipe is configured.
                        </div>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenRecipeModal(item)}
                        className="w-full text-xs h-8 gap-1.5 mt-2"
                      >
                        <ChefHat size={13} />
                        {item.hasRecipe ? "Edit Recipe Formula" : "Configure Recipe"}
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ==================================================== */}
      {/* MODAL 1: ADD / EDIT RAW MATERIAL                     */}
      {/* ==================================================== */}
      <Dialog open={itemModalOpen} onOpenChange={setItemModalOpen}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border">
          <form onSubmit={handleSubmitItem} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-serif font-bold">
                {isEditingItem ? `Edit Material: ${selectedItem?.name}` : "Add Raw Material or Supply"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Raw materials are tracked in their native base unit (e.g. kg, litres, pcs) and consumed via recipes or manual logs.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div>
                <Label className="text-xs font-semibold">Material Name *</Label>
                <Input
                  required
                  placeholder="e.g. Fresh Chicken Breast, Coffee Beans, Full Cream Milk"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 text-xs h-9"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Category *</Label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full mt-1 h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
                  >
                    {RAW_MATERIAL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Base Measurement Unit *</Label>
                  <select
                    value={formBaseUnit}
                    onChange={(e) => setFormBaseUnit(e.target.value)}
                    className="w-full mt-1 h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground font-mono"
                  >
                    {PREDEFINED_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">
                    {isEditingItem ? "Current Stock (Read Only)" : "Opening Stock Quantity"}
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    disabled={isEditingItem}
                    value={formOpeningStock}
                    onChange={(e) => setFormOpeningStock(e.target.value)}
                    className="mt-1 text-xs h-9 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Low-Stock Alert Threshold *</Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="e.g. 2"
                    value={formThreshold}
                    onChange={(e) => setFormThreshold(e.target.value)}
                    className="mt-1 text-xs h-9 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Supplier Name (Optional)</Label>
                  <Input
                    placeholder="e.g. FreshFarm Supplies"
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    className="mt-1 text-xs h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Purchase Unit Cost ₹ (Optional)</Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 320.00"
                    value={formUnitCost}
                    onChange={(e) => setFormUnitCost(e.target.value)}
                    className="mt-1 text-xs h-9 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Batch / Lot Number (Optional)</Label>
                  <Input
                    placeholder="e.g. BATCH-2026-A"
                    value={formBatchNumber}
                    onChange={(e) => setFormBatchNumber(e.target.value)}
                    className="mt-1 text-xs h-9 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Expiry Date (Optional)</Label>
                  <Input
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="mt-1 text-xs h-9"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">SKU / Item Code (Optional)</Label>
                <Input
                  placeholder="e.g. RAW-CHK-01"
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                  className="mt-1 text-xs h-9 font-mono"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setItemModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmittingItem} className="bg-[#7B4E35] text-white hover:bg-[#633E2B]">
                {isSubmittingItem ? "Saving..." : isEditingItem ? "Save Changes" : "Create Material"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* MODAL 2: STOCK IN / STOCK OUT / ADJUSTMENT           */}
      {/* ==================================================== */}
      <Dialog open={movementModalOpen} onOpenChange={setMovementModalOpen}>
        <DialogContent className="sm:max-w-[460px] bg-card border-border">
          <form onSubmit={handleSubmitMovement} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-serif font-bold flex items-center gap-2">
                {movementType === "stock_in" ? (
                  <span className="text-emerald-700 flex items-center gap-1.5">
                    <ArrowDownLeft size={16} /> Receive Goods (Stock In)
                  </span>
                ) : movementType === "stock_out" ? (
                  <span className="text-amber-700 flex items-center gap-1.5">
                    <ArrowUpRight size={16} /> Record Stock Out
                  </span>
                ) : (
                  <span className="text-blue-700 flex items-center gap-1.5">
                    <Layers size={16} /> Adjust Stock Balance
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {movementType === "stock_in"
                  ? "Record incoming delivery or restock with optional supplier, invoice reference, and batch expiry."
                  : movementType === "stock_out"
                  ? "Record stock removed for prep, spoilage, or kitchen usage."
                  : "Correct on-hand quantity after a physical audit."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              {/* Material Select */}
              <div>
                <Label className="text-xs font-semibold">Raw Material Item *</Label>
                <select
                  value={movItem?.id || ""}
                  onChange={(e) => {
                    const found = allRawMaterials.find((i) => i.id === Number(e.target.value));
                    if (found) {
                      setMovItem(found);
                      setMovUnit(found.baseUnit);
                      if (found.supplier) setMovSupplier(found.supplier);
                      if (found.unitCost) setMovUnitCost(String(found.unitCost));
                    }
                  }}
                  className="w-full mt-1 h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
                >
                  {allRawMaterials.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.currentStock} {item.baseUnit} on hand)
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity and Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">
                    {movementType === "stock_in" ? "Quantity to Receive *" : movementType === "stock_out" ? "Quantity to Deduct *" : "New Verified Quantity *"}
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    min="0.001"
                    required
                    placeholder="e.g. 10"
                    value={movQty}
                    onChange={(e) => setMovQty(e.target.value)}
                    className="mt-1 text-xs h-9 font-mono"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Unit *</Label>
                  <select
                    value={movUnit}
                    onChange={(e) => setMovUnit(e.target.value)}
                    className="w-full mt-1 h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground font-mono"
                  >
                    {PREDEFINED_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reason / Notes */}
              <div>
                <Label className="text-xs font-semibold">
                  Reason / Notes {movementType !== "stock_in" && "*"}
                </Label>
                <Input
                  required={movementType !== "stock_in"}
                  placeholder={
                    movementType === "stock_in"
                      ? "e.g. Weekly vendor order delivery"
                      : movementType === "stock_out"
                      ? "e.g. Kitchen prep waste, spillage, expired stock"
                      : "e.g. Physical inventory count discrepancy"
                  }
                  value={movReason}
                  onChange={(e) => setMovReason(e.target.value)}
                  className="mt-1 text-xs h-9"
                />
              </div>

              {/* Stock In Extra Fields */}
              {movementType === "stock_in" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Supplier Name</Label>
                      <Input
                        placeholder="e.g. Metro Wholesale"
                        value={movSupplier}
                        onChange={(e) => setMovSupplier(e.target.value)}
                        className="mt-1 text-xs h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Invoice / Reference #</Label>
                      <Input
                        placeholder="e.g. INV-2026-908"
                        value={movInvoiceRef}
                        onChange={(e) => setMovInvoiceRef(e.target.value)}
                        className="mt-1 text-xs h-9 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Unit Purchase Cost ₹</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="e.g. 280.00"
                        value={movUnitCost}
                        onChange={(e) => setMovUnitCost(e.target.value)}
                        className="mt-1 text-xs h-9 font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Batch / Lot #</Label>
                      <Input
                        placeholder="e.g. LOT-45B"
                        value={movBatchNumber}
                        onChange={(e) => setMovBatchNumber(e.target.value)}
                        className="mt-1 text-xs h-9 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Expiry Date</Label>
                    <Input
                      type="date"
                      value={movExpiryDate}
                      onChange={(e) => setMovExpiryDate(e.target.value)}
                      className="mt-1 text-xs h-9"
                    />
                  </div>
                </>
              )}

              {/* Balance Preview */}
              {movItem && (
                <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Current Stock:</span>
                  <span className="font-bold text-foreground">
                    {movItem.currentStock} {movItem.baseUnit}
                  </span>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setMovementModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingMov || !movQty}
                className={
                  movementType === "stock_in"
                    ? "bg-emerald-700 text-white hover:bg-emerald-800"
                    : movementType === "stock_out"
                    ? "bg-amber-700 text-white hover:bg-amber-800"
                    : "bg-blue-700 text-white hover:bg-blue-800"
                }
              >
                {isSubmittingMov ? "Recording..." : "Confirm Movement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* MODAL 3: INGREDIENT RECIPE FORMULA EDITOR            */}
      {/* ==================================================== */}
      <Dialog open={recipeModalOpen} onOpenChange={setRecipeModalOpen}>
        <DialogContent className="sm:max-w-[560px] bg-card border-border">
          <form onSubmit={handleSaveRecipe} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-serif font-bold flex items-center gap-2">
                <ChefHat size={17} className="text-[#7B4E35]" />
                Recipe Formula: {selectedMenuItem?.menuItemName}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Specify the exact raw materials consumed per serving. Quantities will be converted to each material's base
                unit and deducted transactionally when this item is ordered.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs max-h-[380px] overflow-y-auto pr-1">
              {recipeIngredients.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground border border-dashed rounded-xl space-y-2">
                  <p>No ingredients added yet.</p>
                  <Button type="button" size="sm" variant="outline" onClick={handleAddIngredientRow} className="text-xs">
                    <Plus size={12} className="mr-1" /> Add Ingredient
                  </Button>
                </div>
              ) : (
                recipeIngredients.map((row, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-border/80 bg-muted/30 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-[11px] font-semibold text-muted-foreground">
                        Ingredient #{idx + 1}
                      </Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveIngredientRow(idx)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-rose-600"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Material Selection */}
                      <div className="sm:col-span-2">
                        <select
                          value={row.rawMaterialId}
                          onChange={(e) => {
                            const newId = Number(e.target.value);
                            const found = allRawMaterials.find((r) => r.id === newId);
                            const updated = [...recipeIngredients];
                            updated[idx] = {
                              ...updated[idx],
                              rawMaterialId: newId,
                              unit: found?.baseUnit || updated[idx].unit,
                            };
                            setRecipeIngredients(updated);
                          }}
                          className="w-full h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                        >
                          {allRawMaterials.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name} (Base: {r.baseUnit})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div>
                        <Input
                          type="number"
                          step="any"
                          min="0.001"
                          required
                          placeholder="Qty"
                          value={row.quantity}
                          onChange={(e) => {
                            const updated = [...recipeIngredients];
                            updated[idx] = { ...updated[idx], quantity: parseFloat(e.target.value) || 0 };
                            setRecipeIngredients(updated);
                          }}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Unit */}
                      <div>
                        <select
                          value={row.unit}
                          onChange={(e) => {
                            const updated = [...recipeIngredients];
                            updated[idx] = { ...updated[idx], unit: e.target.value };
                            setRecipeIngredients(updated);
                          }}
                          className="w-full h-8 rounded-lg border border-border bg-background px-2 text-xs font-mono text-foreground"
                        >
                          {PREDEFINED_UNITS.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Notes */}
                      <div>
                        <Input
                          placeholder="Notes (e.g. freshly chopped)"
                          value={row.notes}
                          onChange={(e) => {
                            const updated = [...recipeIngredients];
                            updated[idx] = { ...updated[idx], notes: e.target.value };
                            setRecipeIngredients(updated);
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}

              {recipeIngredients.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddIngredientRow}
                  className="w-full h-8 text-xs border-dashed gap-1"
                >
                  <Plus size={12} /> Add Another Ingredient
                </Button>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setRecipeModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingRecipe}
                className="bg-[#7B4E35] text-white hover:bg-[#633E2B]"
              >
                {isSubmittingRecipe ? "Saving Recipe..." : "Save Recipe"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

