import { useEffect, useState } from "react";
import { getSettings, updateSettings, uploadImage, RestaurantSettings } from "@/lib/api";
import { Loader2, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [preview, setPreview] = useState<string | null>(value || null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setPreview(value || null);
  }, [value]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const res = await uploadImage(file);
      onChange(res.url);
      setPreview(res.url);
      toast({ title: "Uploaded", description: "Image saved to local volume." });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: err.message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {preview && (
        <div className="w-full h-32 rounded-lg overflow-hidden border border-border bg-[#F8F5EF] flex items-center justify-center">
          <img
            src={preview}
            alt={label}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setPreview(e.target.value);
          }}
          placeholder="/uploads/image.png or URL"
          className="flex-1"
        />
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
            disabled={isUploading}
          />
          <Button
            type="button"
            variant="outline"
            disabled={isUploading}
            asChild
          >
            <span>
              {isUploading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <>
                  <Upload size={14} className="mr-1.5" /> Upload
                </>
              )}
            </span>
          </Button>
        </label>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    restaurantName: "",
    tagline: "",
    address: "",
    gstin: "",
    whatsappNumber: "",
    openingHours: "",
    logoUrl: "",
    bannerUrl: "",
    primaryColor: "#c9a96e",
  });

  useEffect(() => {
    getSettings()
      .then((data) => {
        setForm({
          restaurantName: data.restaurantName ?? "",
          tagline: data.tagline ?? "",
          address: data.address ?? "",
          gstin: data.gstin ?? "",
          whatsappNumber: data.whatsappNumber ?? "",
          openingHours: data.openingHours ?? "",
          logoUrl: data.logoUrl ?? "",
          bannerUrl: data.bannerUrl ?? "",
          primaryColor: data.primaryColor ?? "#c9a96e",
        });
      })
      .catch((err) => {
        toast({
          variant: "destructive",
          title: "Failed to load settings",
          description: err.message,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(form);
      toast({
        title: "Settings Saved",
        description: "Local café settings updated successfully.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-foreground mb-1">
            Restaurant Settings
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure your local café brand, contact details, and appearance.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 size={14} className="mr-2 animate-spin" />
          ) : (
            <Save size={14} className="mr-2" />
          )}
          Save Settings
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="restaurantName">Café / Restaurant Name</Label>
          <Input
            id="restaurantName"
            value={form.restaurantName}
            onChange={(e) =>
              setForm((f) => ({ ...f, restaurantName: e.target.value }))
            }
            placeholder="Kusum Kunja Café"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tagline">Tagline / Slogan</Label>
          <Input
            id="tagline"
            value={form.tagline}
            onChange={(e) =>
              setForm((f) => ({ ...f, tagline: e.target.value }))
            }
            placeholder="Crafted with passion, served with love"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Physical Address</Label>
          <Textarea
            id="address"
            rows={2}
            value={form.address}
            onChange={(e) =>
              setForm((f) => ({ ...f, address: e.target.value }))
            }
            placeholder="123 Coffee Lane, Artisan District"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gstin">GSTIN (optional)</Label>
          <Input
            id="gstin"
            value={form.gstin}
            onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))}
            placeholder="Enter your café's GSTIN"
            maxLength={15}
          />
          <p className="text-xs text-muted-foreground">Shown on customer receipts when provided.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="whatsappNumber">WhatsApp Number (with country code)</Label>
            <Input
              id="whatsappNumber"
              value={form.whatsappNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, whatsappNumber: e.target.value }))
              }
              placeholder="+919876543210"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="openingHours">Opening Hours</Label>
            <Input
              id="openingHours"
              value={form.openingHours}
              onChange={(e) =>
                setForm((f) => ({ ...f, openingHours: e.target.value }))
              }
              placeholder="Mon–Sun: 8 AM – 10 PM"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="primaryColor">Theme Accent Color</Label>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              id="primaryColor"
              value={form.primaryColor}
              onChange={(e) =>
                setForm((f) => ({ ...f, primaryColor: e.target.value }))
              }
              className="h-9 w-14 rounded border border-border cursor-pointer bg-transparent"
            />
            <Input
              value={form.primaryColor}
              onChange={(e) =>
                setForm((f) => ({ ...f, primaryColor: e.target.value }))
              }
              className="font-mono text-xs w-32"
            />
          </div>
        </div>

        <ImageField
          label="Logo Image"
          value={form.logoUrl}
          onChange={(logoUrl) => setForm((f) => ({ ...f, logoUrl }))}
        />

        <ImageField
          label="Hero Banner Image"
          value={form.bannerUrl}
          onChange={(bannerUrl) => setForm((f) => ({ ...f, bannerUrl }))}
        />
      </div>
    </div>
  );
}

