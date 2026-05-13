import { useEffect, useState } from "react";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetSettingsQueryKey } from "@workspace/api-client-react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@workspace/object-storage-web";

function getImageSrc(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("/objects/")) return `/api/storage${url}`;
  return url;
}

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [preview, setPreview] = useState<string | null>(getImageSrc(value));
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (res) => {
      onChange(res.objectPath);
      setPreview(`/api/storage${res.objectPath}`);
    }
  });

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {preview && (
        <div className="w-full h-32 rounded-lg overflow-hidden border border-border">
          <img src={preview} alt={label} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => { onChange(e.target.value); setPreview(getImageSrc(e.target.value)); }}
          placeholder="https:// or upload below"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          disabled={isUploading}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) {
                setPreview(URL.createObjectURL(file));
                await uploadFile(file);
              }
            };
            input.click();
          }}
        >
          {isUploading ? <Loader2 size={14} className="animate-spin" /> : "Upload"}
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: settings, isLoading } = useGetSettings();
  const updateMutation = useUpdateSettings();

  const [form, setForm] = useState({
    restaurantName: "",
    tagline: "",
    address: "",
    whatsappNumber: "",
    openingHours: "",
    logoUrl: "",
    bannerUrl: "",
    primaryColor: "#c9a96e",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        restaurantName: settings.restaurantName ?? "",
        tagline: settings.tagline ?? "",
        address: settings.address ?? "",
        whatsappNumber: settings.whatsappNumber ?? "",
        openingHours: settings.openingHours ?? "",
        logoUrl: settings.logoUrl ?? "",
        bannerUrl: settings.bannerUrl ?? "",
        primaryColor: settings.primaryColor ?? "#c9a96e",
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateMutation.mutate({ data: form }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ description: "Settings saved successfully" });
      },
      onError: () => toast({ description: "Failed to save settings", variant: "destructive" }),
    });
  };

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif font-bold text-foreground">Restaurant Settings</h2>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />}
          Save Changes
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h3 className="font-semibold text-foreground">Basic Info</h3>
        <div className="space-y-2">
          <Label>Restaurant Name</Label>
          <Input value={form.restaurantName} onChange={(e) => set("restaurantName")(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Tagline</Label>
          <Input value={form.tagline} onChange={(e) => set("tagline")(e.target.value)} placeholder="Crafted with passion..." />
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Textarea value={form.address} onChange={(e) => set("address")(e.target.value)} rows={2} />
        </div>
        <div className="space-y-2">
          <Label>Opening Hours</Label>
          <Input value={form.openingHours} onChange={(e) => set("openingHours")(e.target.value)} placeholder="Mon–Sun: 8am – 10pm" />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h3 className="font-semibold text-foreground">Contact & Ordering</h3>
        <div className="space-y-2">
          <Label>WhatsApp Number</Label>
          <Input
            value={form.whatsappNumber}
            onChange={(e) => set("whatsappNumber")(e.target.value)}
            placeholder="+91 98765 43210"
          />
          <p className="text-xs text-muted-foreground">Include country code. Customers will send orders here.</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h3 className="font-semibold text-foreground">Branding</h3>
        <div className="space-y-2">
          <Label>Accent Color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.primaryColor}
              onChange={(e) => set("primaryColor")(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-border"
            />
            <Input value={form.primaryColor} onChange={(e) => set("primaryColor")(e.target.value)} className="max-w-32" />
          </div>
        </div>
        <ImageField label="Logo" value={form.logoUrl} onChange={set("logoUrl")} />
        <ImageField label="Hero Banner" value={form.bannerUrl} onChange={set("bannerUrl")} />
      </div>
    </div>
  );
}
