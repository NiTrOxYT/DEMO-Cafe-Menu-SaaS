import { useState, useRef } from "react";
import { QrCode, Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetSettings } from "@workspace/api-client-react";

function getMenuUrl(table?: string) {
  const base = window.location.origin + (import.meta.env.BASE_URL ?? "/");
  return table ? `${base}?table=${encodeURIComponent(table)}` : base;
}

function QRCodeSvg({ value, size = 200 }: { value: string; size?: number }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&format=png&bgcolor=FFFFFF&color=0f0e0c&margin=10`;
  return <img src={src} alt="QR Code" style={{ width: size, height: size }} className="rounded-lg" />;
}

type TableEntry = { id: string; number: string };

export default function QRPage() {
  const { data: settings } = useGetSettings();
  const restaurantName = settings?.restaurantName ?? "The Golden Brew";
  const [tables, setTables] = useState<TableEntry[]>([
    { id: "1", number: "1" },
    { id: "2", number: "2" },
    { id: "3", number: "3" },
  ]);
  const [newTable, setNewTable] = useState("");

  const addTable = () => {
    const num = newTable.trim();
    if (!num || tables.some((t) => t.number === num)) return;
    setTables((prev) => [...prev, { id: String(Date.now()), number: num }]);
    setNewTable("");
  };

  const removeTable = (id: string) => setTables((prev) => prev.filter((t) => t.id !== id));

  const downloadQR = (tableNumber: string) => {
    const url = getMenuUrl(tableNumber);
    const src = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(url)}&format=png&bgcolor=FFFFFF&color=0f0e0c&margin=20`;
    const a = document.createElement("a");
    a.href = src;
    a.download = `qr-table-${tableNumber}.png`;
    a.target = "_blank";
    a.click();
  };

  const downloadGeneralQR = () => {
    const url = getMenuUrl();
    const src = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(url)}&format=png&bgcolor=FFFFFF&color=0f0e0c&margin=20`;
    const a = document.createElement("a");
    a.href = src;
    a.download = `qr-general-menu.png`;
    a.target = "_blank";
    a.click();
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-2xl font-serif font-bold text-foreground mb-1">QR Code Generator</h2>
        <p className="text-sm text-muted-foreground">Generate QR codes for each table or a general menu link.</p>
      </div>

      {/* General QR */}
      <div className="bg-card rounded-xl border border-border p-6 flex flex-col md:flex-row items-center gap-6">
        <QRCodeSvg value={getMenuUrl()} size={160} />
        <div className="flex-1 text-center md:text-left">
          <h3 className="text-lg font-serif font-bold text-foreground mb-1">{restaurantName}</h3>
          <p className="text-sm text-muted-foreground mb-1">General menu QR — place at entrance or counter</p>
          <p className="text-xs text-muted-foreground font-mono break-all mb-4">{getMenuUrl()}</p>
          <Button onClick={downloadGeneralQR}>
            <Download size={14} className="mr-2" /> Download QR
          </Button>
        </div>
      </div>

      {/* Table QRs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif font-bold text-foreground">Table QR Codes</h3>
        </div>

        {/* Add table */}
        <div className="flex gap-2 mb-6">
          <Input
            value={newTable}
            onChange={(e) => setNewTable(e.target.value)}
            placeholder="Table number (e.g. 4)"
            className="max-w-48"
            onKeyDown={(e) => e.key === "Enter" && addTable()}
          />
          <Button onClick={addTable} disabled={!newTable.trim()}>
            <Plus size={14} className="mr-1" /> Add Table
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tables.map((table) => (
            <div key={table.id} className="bg-card rounded-xl border border-border p-5 flex flex-col items-center gap-4">
              <div className="flex items-center justify-between w-full">
                <span className="font-semibold text-foreground">Table {table.number}</span>
                <button onClick={() => removeTable(table.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
              <QRCodeSvg value={getMenuUrl(table.number)} size={140} />
              <p className="text-xs text-muted-foreground font-mono text-center break-all">{getMenuUrl(table.number)}</p>
              <Button variant="outline" size="sm" className="w-full" onClick={() => downloadQR(table.number)}>
                <Download size={12} className="mr-1" /> Download
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
