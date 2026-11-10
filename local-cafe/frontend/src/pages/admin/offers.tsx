import React, { useState, useEffect, useRef } from "react";
import {
  Offer,
  ComboItemEntry,
  MenuItem,
  getOffers,
  createOffer,
  updateOffer,
  toggleOffer,
  deleteOffer,
  getMenu,
  uploadImage,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Upload,
  X,
  Layers,
  Sparkles,
  Percent,
  Calendar,
  Clock,
  Coffee,
  ShoppingBag,
  ExternalLink,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function OffersPage() {
  const { toast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "active" | "discount" | "combo">("all");

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete Confirm State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingOffer, setDeletingOffer] = useState<Offer | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [badge, setBadge] = useState("");
  const [offerType, setOfferType] = useState<"discount" | "combo">("discount");
  const [discountType, setDiscountType] = useState<"percentage" | "flat">("percentage");
  const [discountValue, setDiscountValue] = useState<number | string>(20);
  const [minOrderAmount, setMinOrderAmount] = useState<number | string>(0);
  const [comboPrice, setComboPrice] = useState<number | string>("");
  const [comboItems, setComboItems] = useState<ComboItemEntry[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState<number | string>(0);

  // File Upload State
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Offers & Menu
  const loadData = async () => {
    try {
      setLoading(true);
      const [offersData, menuData] = await Promise.all([
        getOffers(true),
        getMenu().catch(() => []),
      ]);
      setOffers(offersData);
      setMenuItems(menuData);
    } catch (err: any) {
      toast({
        title: "Failed to load offers",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateDialog = () => {
    setEditingOffer(null);
    setTitle("");
    setDescription("");
    setBadge("");
    setOfferType("discount");
    setDiscountType("percentage");
    setDiscountValue(20);
    setMinOrderAmount(0);
    setComboPrice("");
    setComboItems([]);
    setImageUrl("");
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setIsActive(true);
    setSortOrder(0);
    setDialogOpen(true);
  };

  const openEditDialog = (offer: Offer) => {
    setEditingOffer(offer);
    setTitle(offer.title || "");
    setDescription(offer.description || "");
    setBadge(offer.badge || "");
    setOfferType(offer.offerType || "discount");
    setDiscountType(offer.discountType || "percentage");
    setDiscountValue(offer.discountValue ?? 0);
    setMinOrderAmount(offer.minOrderAmount ?? 0);
    setComboPrice(offer.comboPrice !== null && offer.comboPrice !== undefined ? offer.comboPrice : "");
    setComboItems(Array.isArray(offer.comboItems) ? [...offer.comboItems] : []);
    setImageUrl(offer.imageUrl || "");
    setStartDate(offer.startDate ? offer.startDate.split("T")[0] : "");
    setEndDate(offer.endDate ? offer.endDate.split("T")[0] : "");
    setStartTime(offer.startTime ? offer.startTime.slice(0, 5) : "");
    setEndTime(offer.endTime ? offer.endTime.slice(0, 5) : "");
    setIsActive(offer.isActive ?? true);
    setSortOrder(offer.sortOrder ?? 0);
    setDialogOpen(true);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      const res = await uploadImage(file);
      setImageUrl(res.url);
      toast({ title: "Image uploaded successfully" });
    } catch (err: any) {
      toast({
        title: "Image upload failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddComboItem = () => {
    if (menuItems.length > 0) {
      const first = menuItems[0];
      setComboItems([
        ...comboItems,
        { menuItemId: first.id, name: first.name, quantity: 1 },
      ]);
    } else {
      setComboItems([
        ...comboItems,
        { name: "Sample Item", quantity: 1 },
      ]);
    }
  };

  const handleRemoveComboItem = (index: number) => {
    setComboItems(comboItems.filter((_, i) => i !== index));
  };

  const handleComboItemChange = (index: number, menuItemId: number) => {
    const item = menuItems.find((m) => m.id === menuItemId);
    if (!item) return;
    const updated = [...comboItems];
    updated[index] = {
      ...updated[index],
      menuItemId: item.id,
      name: item.name,
    };
    setComboItems(updated);
  };

  const handleComboQtyChange = (index: number, quantity: number) => {
    const updated = [...comboItems];
    updated[index] = {
      ...updated[index],
      quantity: Math.max(1, quantity),
    };
    setComboItems(updated);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: "Title is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const payload: Partial<Offer> = {
        title: title.trim(),
        description: description.trim() || null,
        code: editingOffer?.code || null,
        badge: badge.trim() || null,
        offerType,
        discountType,
        discountValue: Number(discountValue) || 0,
        minOrderAmount: Number(minOrderAmount) || 0,
        comboPrice: comboPrice !== "" ? Number(comboPrice) : null,
        comboItems: offerType === "combo" ? comboItems : [],
        imageUrl: imageUrl.trim() || null,
        startDate: startDate || null,
        endDate: endDate || null,
        startTime: startTime ? `${startTime}:00` : null,
        endTime: endTime ? `${endTime}:00` : null,
        isActive,
        sortOrder: Number(sortOrder) || 0,
      };

      if (editingOffer) {
        await updateOffer(editingOffer.id, payload);
        toast({ title: "Offer updated successfully" });
      } else {
        await createOffer(payload);
        toast({ title: "Offer created successfully" });
      }

      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast({
        title: "Failed to save offer",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (offer: Offer) => {
    try {
      const updated = await toggleOffer(offer.id);
      setOffers((prev) =>
        prev.map((o) => (o.id === offer.id ? { ...o, isActive: updated.isActive } : o))
      );
      toast({
        title: updated.isActive ? "Offer activated" : "Offer deactivated",
      });
    } catch (err: any) {
      toast({
        title: "Failed to toggle status",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingOffer) return;
    try {
      setDeleting(true);
      await deleteOffer(deletingOffer.id);
      toast({ title: `Deleted offer "${deletingOffer.title}"` });
      setDeleteConfirmOpen(false);
      setDeletingOffer(null);
      loadData();
    } catch (err: any) {
      toast({
        title: "Failed to delete offer",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const filteredOffers = offers.filter((offer) => {
    if (filterType === "active") return offer.isActive;
    if (filterType === "discount") return offer.offerType === "discount";
    if (filterType === "combo") return offer.offerType === "combo";
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shadow-xs">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground">
                Offers & Combos
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Manage promotional discounts and meal combos automatically applied for customers.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={openCreateDialog}
          className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs gap-2 font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Offer / Combo
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { key: "all", label: `All (${offers.length})` },
          { key: "active", label: `Active (${offers.filter((o) => o.isActive).length})` },
          { key: "discount", label: `Discounts (${offers.filter((o) => o.offerType === "discount").length})` },
          { key: "combo", label: `Combos (${offers.filter((o) => o.offerType === "combo").length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterType(key as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filterType === key
                ? "bg-amber-600 text-white shadow-2xs"
                : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Offers Grid */}
      {loading ? (
        <div className="py-20 text-center text-muted-foreground">
          <Sparkles className="w-8 h-8 mx-auto animate-pulse text-amber-500 mb-2" />
          <p className="text-sm">Loading offers & combos...</p>
        </div>
      ) : filteredOffers.length === 0 ? (
        <div className="border border-dashed border-border/80 rounded-xl p-12 text-center bg-card/40">
          <Tag className="w-10 h-10 mx-auto text-muted-foreground/60 mb-3" />
          <h3 className="text-base font-semibold text-foreground">No offers found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {filterType === "all"
              ? "Create your first promotional discount or combo to boost customer orders."
              : `No offers match the "${filterType}" filter.`}
          </p>
          <Button
            onClick={openCreateDialog}
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Offer
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOffers.map((offer) => {
            const hasImage = Boolean(offer.imageUrl);
            const isCombo = offer.offerType === "combo";

            return (
              <div
                key={offer.id}
                className={`relative rounded-xl border transition-all duration-200 bg-card overflow-hidden flex flex-col justify-between shadow-2xs ${
                  offer.isActive
                    ? "border-border hover:border-amber-500/40 hover:shadow-sm"
                    : "border-border/60 opacity-75 bg-muted/20"
                }`}
              >
                {/* Optional Image Header */}
                {hasImage ? (
                  <div className="relative h-36 w-full bg-muted overflow-hidden border-b border-border/60">
                    <img
                      src={offer.imageUrl!}
                      alt={offer.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                    {offer.badge && (
                      <Badge className="absolute top-2.5 left-2.5 bg-amber-600 text-white border-0 font-semibold text-[11px] shadow-sm">
                        {offer.badge}
                      </Badge>
                    )}
                    <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white text-xs">
                      <span className="font-semibold text-sm drop-shadow-sm">
                        {isCombo
                          ? `₹${offer.comboPrice}`
                          : offer.discountType === "percentage"
                          ? `${offer.discountValue}% OFF`
                          : `₹${offer.discountValue} OFF`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 pb-0 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="p-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        {isCombo ? <Coffee className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
                      </span>
                      {offer.badge && (
                        <Badge className="bg-amber-600 text-white border-0 text-[10px] font-semibold">
                          {offer.badge}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Content Body */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-serif font-bold text-base text-foreground line-clamp-1">
                        {offer.title}
                      </h4>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          className={`text-[9px] font-semibold border-0 ${
                            offer.isActive
                              ? "bg-emerald-600 text-white hover:bg-emerald-600"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {offer.isActive ? "Live" : "Draft"}
                        </Badge>
                        <Badge
                          variant={isCombo ? "secondary" : "outline"}
                          className="text-[9px] font-medium uppercase"
                        >
                          {isCombo ? "Combo" : "Discount"}
                        </Badge>
                      </div>
                    </div>

                    {!hasImage && (
                      <div className="mt-1 text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {isCombo
                          ? `₹${offer.comboPrice}`
                          : offer.discountType === "percentage"
                          ? `${offer.discountValue}% OFF`
                          : `₹${offer.discountValue} OFF`}
                      </div>
                    )}

                    {offer.description && (
                      <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                        {offer.description}
                      </p>
                    )}

                    {/* Combo Included Items */}
                    {isCombo && Array.isArray(offer.comboItems) && offer.comboItems.length > 0 && (
                      <div className="mt-3 p-2 rounded-lg bg-muted/50 border border-border/50 text-xs">
                        <span className="font-medium text-foreground text-[11px] block mb-1">
                          Includes:
                        </span>
                        <ul className="space-y-0.5 text-muted-foreground">
                          {offer.comboItems.map((item, idx) => (
                            <li key={idx} className="flex items-center justify-between">
                              <span>• {item.name}</span>
                              <span className="font-medium text-[11px]">×{item.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Rules & Meta */}
                    <div className="mt-3 pt-2.5 border-t border-border/50 space-y-1 text-[11px] text-muted-foreground">
                      {offer.minOrderAmount > 0 && (
                        <div className="flex items-center gap-1.5">
                          <ShoppingBag className="w-3 h-3 text-muted-foreground/70" />
                          <span>Min order: ₹{offer.minOrderAmount}</span>
                        </div>
                      )}
                      {(offer.startDate || offer.endDate) && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-muted-foreground/70" />
                          <span>
                            {offer.startDate ? offer.startDate.split("T")[0] : "Always"} to{" "}
                            {offer.endDate ? offer.endDate.split("T")[0] : "Ongoing"}
                          </span>
                        </div>
                      )}
                      {(offer.startTime || offer.endTime) && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-muted-foreground/70" />
                          <span>
                            {offer.startTime?.slice(0, 5)} - {offer.endTime?.slice(0, 5)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={offer.isActive}
                        onCheckedChange={() => handleToggle(offer)}
                        id={`offer-toggle-${offer.id}`}
                      />
                      <label
                        htmlFor={`offer-toggle-${offer.id}`}
                        className="text-xs font-medium cursor-pointer select-none text-muted-foreground"
                      >
                        {offer.isActive ? "Active" : "Paused"}
                      </label>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openEditDialog(offer)}
                        title="Edit Offer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                        onClick={() => {
                          setDeletingOffer(offer);
                          setDeleteConfirmOpen(true);
                        }}
                        title="Delete Offer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {editingOffer ? "Edit Offer / Combo" : "Create New Offer / Combo"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Offer Type Selection */}
            <div>
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOfferType("discount")}
                  className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all ${
                    offerType === "discount"
                      ? "border-amber-600 bg-amber-500/5 ring-1 ring-amber-600/30"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <Percent className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-foreground">Discount Offer</div>
                    <div className="text-xs text-muted-foreground">
                      Percentage or flat rupee discount on entire order or cart.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOfferType("combo")}
                  className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all ${
                    offerType === "combo"
                      ? "border-amber-600 bg-amber-500/5 ring-1 ring-amber-600/30"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <Coffee className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-foreground">Meal / Drink Combo</div>
                    <div className="text-xs text-muted-foreground">
                      Bundle specific menu items together at a special bundle price.
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Title <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 20% Off Breakfast or Coffee & Croissant Combo"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Description
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short explanation of the offer terms or what is inside the combo"
                  rows={2}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Badge / Tag (Optional)
                </label>
                <Input
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder="e.g. Popular, Save ₹40, Limited"
                />
              </div>
            </div>

            {/* Discount or Combo Specifics */}
            {offerType === "discount" ? (
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Discount Type
                    </label>
                    <Select
                      value={discountType}
                      onValueChange={(val: any) => setDiscountType(val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="flat">Flat Amount (₹)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Discount Value {discountType === "percentage" ? "(%)" : "(₹)"}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountType === "percentage" ? "20" : "75"}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Minimum Order Amount (₹)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(e.target.value)}
                    placeholder="0"
                  />
                  <span className="text-[11px] text-muted-foreground mt-0.5 block">
                    Offer only applies when cart subtotal meets or exceeds this amount.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Combo Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={comboPrice}
                    onChange={(e) => setComboPrice(e.target.value)}
                    placeholder="e.g. 189"
                  />
                  <span className="text-[11px] text-muted-foreground mt-0.5 block">
                    Special bundled price charged for this combo.
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Included Menu Items
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddComboItem}
                      className="h-7 text-xs gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Item
                    </Button>
                  </div>

                  {comboItems.length === 0 ? (
                    <div className="text-center py-4 border border-dashed border-border rounded-lg text-xs text-muted-foreground">
                      No items added yet. Click &quot;Add Item&quot; to pick menu items included in this combo.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {comboItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-background p-2 rounded-lg border border-border"
                        >
                          <div className="flex-1">
                            {menuItems.length > 0 ? (
                              <Select
                                value={item.menuItemId ? String(item.menuItemId) : ""}
                                onValueChange={(val) => handleComboItemChange(idx, Number(val))}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select item..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {menuItems.map((m) => (
                                    <SelectItem key={m.id} value={String(m.id)}>
                                      {m.name} (₹{m.price})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                value={item.name}
                                onChange={(e) => {
                                  const updated = [...comboItems];
                                  updated[idx] = { ...updated[idx], name: e.target.value };
                                  setComboItems(updated);
                                }}
                                placeholder="Item name"
                                className="h-8 text-xs"
                              />
                            )}
                          </div>

                          <div className="w-20">
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => handleComboQtyChange(idx, Number(e.target.value))}
                              placeholder="Qty"
                              className="h-8 text-xs"
                            />
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-rose-500 hover:text-rose-600 shrink-0"
                            onClick={() => handleRemoveComboItem(idx)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Optional Image */}
            <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Card Image (Optional)</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Cards look great even without an image!
                </span>
              </label>

              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="gap-1.5 text-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingImage ? "Uploading..." : "Upload Image"}
                </Button>

                <div className="flex-1">
                  <Input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Or paste an image URL (https://...)"
                    className="text-xs h-9"
                  />
                </div>

                {imageUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => setImageUrl("")}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {imageUrl && (
                <div className="mt-2 relative w-full h-28 rounded-lg overflow-hidden border border-border bg-muted">
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Validity Windows & Sorting */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Start Date (Optional)
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  End Date (Optional)
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Daily Start Time (Optional)
                </label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Daily End Time (Optional)
                </label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Display Order
                </label>
                <Input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  placeholder="0"
                />
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  Lower numbers display first to customers.
                </span>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  id="offer-active-switch"
                />
                <label
                  htmlFor="offer-active-switch"
                  className="text-xs font-medium cursor-pointer select-none"
                >
                  Active & Available to Customers
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
            >
              {saving ? "Saving..." : editingOffer ? "Save Changes" : "Create Offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">
              Delete &quot;{deletingOffer?.title}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this offer? Historical orders that used this offer will
              preserve their recorded discount amount and order total accurately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting ? "Deleting..." : "Delete Offer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

