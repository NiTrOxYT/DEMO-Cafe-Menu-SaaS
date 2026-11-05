import { useState, useEffect } from "react";
import { Download, Plus, Trash2, Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSettings, RestaurantSettings } from "@/lib/api";
import QRCode from "qrcode";

const QR_BASE_URL_KEY = "local_cafe_qr_base_url";

function LocalQRCode({
  value,
  size = 200,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: { dark: "#0f0e0c", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch((err) => {
        console.error("Local QR generation error:", err);
      });

    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-muted/40 animate-pulse rounded-lg flex items-center justify-center ${className || ""}`}
      >
        <span className="text-xs text-muted-foreground">Rendering QR...</span>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="Table QR Code"
      style={{ width: size, height: size }}
      className={`rounded-lg shadow-sm bg-white p-1 border border-border/40 ${className || ""}`}
    />
  );
}

type TableEntry = { id: string; number: string };

export default function QRPage() {
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [tables, setTables] = useState<TableEntry[]>([
    { id: "1", number: "1" },
    { id: "2", number: "2" },
    { id: "3", number: "3" },
    { id: "4", number: "4" },
    { id: "5", number: "5" },
  ]);
  const [newTable, setNewTable] = useState("");
  const [publicBaseUrl, setPublicBaseUrl] = useState(() => {
    return localStorage.getItem(QR_BASE_URL_KEY) || window.location.origin;
  });
  const [urlSavedNotice, setUrlSavedNotice] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {});
  }, []);

  const handleBaseUrlChange = (val: string) => {
    setPublicBaseUrl(val);
    localStorage.setItem(QR_BASE_URL_KEY, val);
    setUrlSavedNotice(true);
    setTimeout(() => setUrlSavedNotice(false), 2000);
  };

  const getMenuUrl = (table?: string) => {
    let cleanBase = publicBaseUrl.trim();
    if (!cleanBase) cleanBase = window.location.origin;
    if (!cleanBase.endsWith("/")) cleanBase += "/";
    return table ? `${cleanBase}?table=${encodeURIComponent(table)}` : cleanBase;
  };

  const restaurantName = settings?.restaurantName ?? "The Golden Brew";

  const addTable = () => {
    const num = newTable.trim();
    if (!num || tables.some((t) => t.number === num)) return;
    setTables((prev) => [...prev, { id: String(Date.now()), number: num }]);
    setNewTable("");
  };

  const removeTable = (id: string) =>
    setTables((prev) => prev.filter((t) => t.id !== id));

  const downloadQR = async (tableNumber: string) => {
    const url = getMenuUrl(tableNumber);
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 1024,
        margin: 2,
        color: { dark: "#0f0e0c", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `qr-table-${tableNumber}.png`;
      a.click();
    } catch (err) {
      console.error("Failed to download QR:", err);
    }
  };

  const downloadGeneralQR = async () => {
    const url = getMenuUrl();
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 1024,
        margin: 2,
        color: { dark: "#0f0e0c", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `qr-general-menu.png`;
      a.click();
    } catch (err) {
      console.error("Failed to download general QR:", err);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-2xl font-serif font-bold text-foreground mb-1">
          QR Code Generator
        </h2>
        <p className="text-sm text-muted-foreground">
          Generate high-resolution printable QR codes locally in the browser with zero external network dependencies.
        </p>
      </div>

      {/* Public URL Ingress Configuration */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="text-primary" size={18} />
          <h3 className="text-sm font-semibold text-foreground">
            Configured Public HTTPS Hostname (For Printed QR Codes)
          </h3>
          {urlSavedNotice && (
            <span className="flex items-center text-xs text-green-600 gap-1 ml-auto">
              <Check size={14} /> Saved
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Customers scanning QR codes on mobile cellular data (4G/5G) cannot reach private local LAN addresses (such as 192.168.x.x). Enter your stable public HTTPS domain (e.g., provided via Cloudflare Tunnel: <code>https://menu.yourcafe.com</code>). This hostname and the table parameter will be encoded directly into every printed QR code.
        </p>
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="https://menu.yourcafe.com"
            value={publicBaseUrl}
            onChange={(e) => handleBaseUrlChange(e.target.value)}
            className="font-mono text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBaseUrlChange(window.location.origin)}
            title="Reset to current browser origin"
          >
            Reset to Origin
          </Button>
        </div>
      </div>

      {/* General QR */}
      <div className="bg-card rounded-xl border border-border p-6 flex flex-col md:flex-row items-center gap-6">
        <LocalQRCode value={getMenuUrl()} size={160} />
        <div className="flex-1 text-center md:text-left">
          <h3 className="text-lg font-serif font-bold text-foreground mb-1">
            {restaurantName}
          </h3>
          <p className="text-sm text-muted-foreground mb-1">
            General menu QR — place at entrance, counter, or takeaway cards
          </p>
          <p className="text-xs text-muted-foreground font-mono break-all mb-4">
            {getMenuUrl()}
          </p>
          <Button onClick={downloadGeneralQR}>
            <Download size={14} className="mr-2" /> Download QR (PNG)
          </Button>
        </div>
      </div>

      {/* Table QRs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-serif font-bold text-foreground">
              Table QR Codes
            </h3>
            <p className="text-xs text-muted-foreground">
              Each QR code automatically assigns the table number when scanned by customers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Table #"
              value={newTable}
              onChange={(e) => setNewTable(e.target.value)}
              className="w-24 h-9"
              onKeyDown={(e) => e.key === "Enter" && addTable()}
            />
            <Button size="sm" onClick={addTable}>
              <Plus size={14} className="mr-1" /> Add Table
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {tables.map((t) => (
            <div
              key={t.id}
              className="bg-card rounded-xl border border-border p-4 flex flex-col items-center gap-3 relative group"
            >
              <button
                onClick={() => removeTable(t.id)}
                className="absolute top-2 right-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1"
                title="Remove table"
              >
                <Trash2 size={14} />
              </button>
              <LocalQRCode value={getMenuUrl(t.number)} size={130} />
              <div className="text-center w-full">
                <span className="font-semibold text-sm text-foreground">
                  Table {t.number}
                </span>
                <p className="text-xs text-muted-foreground font-mono truncate max-w-full">
                  {getMenuUrl(t.number)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => downloadQR(t.number)}
              >
                <Download size={12} className="mr-1.5" /> Download
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
