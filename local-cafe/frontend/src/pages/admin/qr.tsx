import React, { useState, useEffect } from "react";
import {
  Download,
  Printer,
  FileText,
  Plus,
  Trash2,
  Globe,
  Check,
  Coffee,
  Leaf,
  Sparkles,
  ExternalLink,
  Scissors,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getSettings, RestaurantSettings } from "@/lib/api";
import QRCode from "qrcode";
import jsPDF from "jspdf";

const QR_BASE_URL_KEY = "local_cafe_qr_base_url";
const QR_THEME_KEY = "local_cafe_qr_botanical_theme";
const QR_TABLES_KEY = "local_cafe_qr_tables_list";

type TableEntry = { id: string; number: string };
type ThemeOption = "mint" | "cream";

interface ThemeColors {
  name: string;
  cardBg: string;
  innerBorder: string;
  outerBorder: string;
  pillBg: string;
  pillBorder: string;
  qrDark: string;
  qrLight: string;
  textHeading: string;
  textSub: string;
  textBody: string;
  stepsBg: string;
  stepsBorder: string;
  stepsText: string;
  leafPrimary: string;
  leafSecondary: string;
  leafLight: string;
}

const THEMES: Record<ThemeOption, ThemeColors> = {
  mint: {
    name: "Pale Mint & Forest Green",
    cardBg: "#EFF5EE",
    innerBorder: "rgba(22, 60, 35, 0.35)",
    outerBorder: "#194326",
    pillBg: "#E0ECE0",
    pillBorder: "#2E643E",
    qrDark: "#153C22",
    qrLight: "#FFFFFF",
    textHeading: "#143A21",
    textSub: "#2E643E",
    textBody: "#3C5D46",
    stepsBg: "#E3EDE2",
    stepsBorder: "#B7D2B6",
    stepsText: "#184225",
    leafPrimary: "#1E4B2C",
    leafSecondary: "#3B734C",
    leafLight: "#68A07A",
  },
  cream: {
    name: "Warm Cream & Forest Green",
    cardBg: "#FAF6EE",
    innerBorder: "rgba(35, 65, 45, 0.35)",
    outerBorder: "#244530",
    pillBg: "#EEE6D7",
    pillBorder: "#386847",
    qrDark: "#153C22",
    qrLight: "#FFFFFF",
    textHeading: "#183F24",
    textSub: "#386847",
    textBody: "#48624E",
    stepsBg: "#EEE6D7",
    stepsBorder: "#D2C5AF",
    stepsText: "#22472F",
    leafPrimary: "#224D2F",
    leafSecondary: "#427653",
    leafLight: "#719E80",
  },
};

/**
 * Botanical Fern Frond SVG Illustration (Inspired by the reference image's lush fern fronds)
 */
function FernFrond({
  className = "",
  primaryColor = "#1E4B2C",
  secondaryColor = "#3B734C",
  lightColor = "#68A07A",
}: {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
  lightColor?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 120"
      className={`pointer-events-none ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Central curving rachis/stem */}
      <path
        d="M 50 115 Q 52 70 20 10"
        stroke={primaryColor}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Alternating pinnate fern leaflets */}
      {/* Pair 1 (base) */}
      <path
        d="M 48 95 C 60 90 68 96 66 102 C 63 107 50 99 48 95 Z"
        fill={secondaryColor}
      />
      <path
        d="M 47 98 C 34 94 27 101 29 107 C 32 112 45 102 47 98 Z"
        fill={primaryColor}
      />
      {/* Pair 2 */}
      <path
        d="M 45 78 C 60 71 69 77 66 84 C 63 90 48 83 45 78 Z"
        fill={primaryColor}
      />
      <path
        d="M 44 82 C 28 77 20 85 22 92 C 25 97 41 87 44 82 Z"
        fill={lightColor}
      />
      {/* Pair 3 */}
      <path
        d="M 40 60 C 56 52 64 57 62 65 C 59 70 43 65 40 60 Z"
        fill={secondaryColor}
      />
      <path
        d="M 38 64 C 22 58 14 66 17 73 C 20 78 35 69 38 64 Z"
        fill={primaryColor}
      />
      {/* Pair 4 */}
      <path
        d="M 34 44 C 49 35 56 40 53 47 C 50 53 37 48 34 44 Z"
        fill={primaryColor}
      />
      <path
        d="M 32 47 C 17 41 10 49 13 55 C 16 60 29 52 32 47 Z"
        fill={lightColor}
      />
      {/* Pair 5 (near tip) */}
      <path
        d="M 27 28 C 40 20 46 25 43 31 C 41 36 30 32 27 28 Z"
        fill={secondaryColor}
      />
      <path
        d="M 25 31 C 12 25 7 32 10 37 C 13 41 22 35 25 31 Z"
        fill={primaryColor}
      />
      {/* Delicate tip frond */}
      <path
        d="M 20 10 C 23 4 17 2 15 6 C 13 9 17 12 20 10 Z"
        fill={lightColor}
      />
    </svg>
  );
}

/**
 * Small Corner Botanical Leaf Sprig
 */
function BotanicalCorner({
  className = "",
  primaryColor = "#1E4B2C",
  secondaryColor = "#3B734C",
}: {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`w-12 h-12 pointer-events-none ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M 12 12 Q 35 25 75 75"
        stroke={primaryColor}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M 24 22 C 22 14 30 12 34 16 C 36 19 30 25 24 22 Z"
        fill={secondaryColor}
      />
      <path
        d="M 22 24 C 14 22 12 30 16 34 C 19 36 25 30 22 24 Z"
        fill={primaryColor}
      />
      <path
        d="M 38 34 C 36 24 46 22 51 27 C 53 31 46 38 38 34 Z"
        fill={primaryColor}
      />
      <path
        d="M 34 38 C 24 36 22 46 27 51 C 31 53 38 46 34 38 Z"
        fill={secondaryColor}
      />
      <path
        d="M 52 48 C 51 36 62 34 67 40 C 70 45 61 54 52 48 Z"
        fill={secondaryColor}
      />
      <path
        d="M 48 52 C 36 51 34 62 40 67 C 45 70 54 61 48 52 Z"
        fill={primaryColor}
      />
      <path
        d="M 66 62 C 67 52 76 51 80 56 C 83 60 76 68 66 62 Z"
        fill={primaryColor}
      />
      <circle cx="75" cy="75" r="2" fill={secondaryColor} />
    </svg>
  );
}

/**
 * Botanical Table QR Card Component
 * Resembles the fern botanical QR code reference image:
 * - Rich forest-green QR modules (#153C22)
 * - Pale mint background
 * - Botanical fern fronds sprouting organically around the QR code and finder squares
 * - NO visible URL text at bottom
 * - Clear "Scan to order" label, café name, and table number
 */
function BotanicalQRCard({
  tableNumber,
  url,
  restaurantName,
  tagline,
  theme = "mint",
  size = "normal",
  className = "",
}: {
  tableNumber?: string;
  url: string;
  restaurantName: string;
  tagline?: string;
  theme?: ThemeOption;
  size?: "normal" | "compact";
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const activeTheme = THEMES[theme] || THEMES.mint;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, {
      width: 640,
      margin: 2,
      color: { dark: activeTheme.qrDark, light: activeTheme.qrLight },
      errorCorrectionLevel: "H",
    })
      .then((qrUrl) => {
        if (active) setDataUrl(qrUrl);
      })
      .catch((err) => console.error("QR render error:", err));

    return () => {
      active = false;
    };
  }, [url, activeTheme]);

  const isGeneral = !tableNumber;
  const isCompact = size === "compact";

  return (
    <div
      style={{ backgroundColor: activeTheme.cardBg }}
      className={`relative rounded-3xl border-2 transition-all duration-300 shadow-md flex flex-col justify-between overflow-hidden select-none ${
        isCompact ? "w-64 p-3.5" : "w-[300px] sm:w-[324px] p-5"
      } ${className}`}
      style-border-color={activeTheme.outerBorder}
    >
      {/* Decorative Outer & Inner Borders */}
      <div
        className="absolute inset-2.5 rounded-2xl pointer-events-none border"
        style={{ borderColor: activeTheme.innerBorder }}
      />
      <div
        className="absolute inset-3.5 rounded-[14px] pointer-events-none border border-dashed opacity-40"
        style={{ borderColor: activeTheme.innerBorder }}
      />

      {/* 4 Corner Botanical Fern Illustrations */}
      <div className="absolute top-1 left-1">
        <BotanicalCorner
          primaryColor={activeTheme.leafPrimary}
          secondaryColor={activeTheme.leafSecondary}
        />
      </div>
      <div className="absolute top-1 right-1 transform scale-x-[-1]">
        <BotanicalCorner
          primaryColor={activeTheme.leafPrimary}
          secondaryColor={activeTheme.leafSecondary}
        />
      </div>
      <div className="absolute bottom-1 left-1 transform scale-y-[-1]">
        <BotanicalCorner
          primaryColor={activeTheme.leafPrimary}
          secondaryColor={activeTheme.leafSecondary}
        />
      </div>
      <div className="absolute bottom-1 right-1 transform scale-[-1]">
        <BotanicalCorner
          primaryColor={activeTheme.leafPrimary}
          secondaryColor={activeTheme.leafSecondary}
        />
      </div>

      {/* Card Content Wrapper */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-3 my-0.5">
        {/* Botanical Café Header */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-center gap-1.5 text-xs">
            <span style={{ color: activeTheme.leafPrimary }}>🌿</span>
            <span
              className="text-[9px] font-bold uppercase tracking-[0.25em]"
              style={{ color: activeTheme.textSub }}
            >
              {tagline || "Artisanal Roastery & Café"}
            </span>
            <span style={{ color: activeTheme.leafPrimary }}>🌿</span>
          </div>

          <h3
            className="font-serif font-bold tracking-wider uppercase text-base sm:text-lg"
            style={{ color: activeTheme.textHeading }}
          >
            {restaurantName}
          </h3>

          {/* Table Number Pill */}
          <div className="pt-0.5">
            <span
              style={{
                backgroundColor: activeTheme.pillBg,
                borderColor: activeTheme.pillBorder,
                color: activeTheme.textHeading,
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-0.5 rounded-full border text-xs font-mono font-bold tracking-wider shadow-2xs"
            >
              <Coffee size={12} style={{ color: activeTheme.textSub }} />
              {isGeneral ? "COUNTER / MAIN MENU" : `TABLE ${tableNumber}`}
            </span>
          </div>
        </div>

        {/* QR Code Container with Integrated Botanical Ferns */}
        <div className="relative p-3 bg-white rounded-2xl border border-black/10 shadow-xs flex items-center justify-center my-0.5">
          {/* Sprouting Fern Fronds (Around Top-Left Finder Box) */}
          <div className="absolute -top-3.5 -left-3.5 w-12 h-14 z-20 transform -rotate-12 pointer-events-none">
            <FernFrond
              primaryColor={activeTheme.leafPrimary}
              secondaryColor={activeTheme.leafSecondary}
              lightColor={activeTheme.leafLight}
            />
          </div>

          {/* Sprouting Fern Fronds (Around Top-Right Finder Box) */}
          <div className="absolute -top-3.5 -right-3.5 w-12 h-14 z-20 transform scale-x-[-1] -rotate-12 pointer-events-none">
            <FernFrond
              primaryColor={activeTheme.leafPrimary}
              secondaryColor={activeTheme.leafSecondary}
              lightColor={activeTheme.leafLight}
            />
          </div>

          {/* Sprouting Fern Fronds (Around Bottom-Left Finder Box) */}
          <div className="absolute -bottom-3.5 -left-3.5 w-12 h-14 z-20 transform scale-y-[-1] rotate-12 pointer-events-none">
            <FernFrond
              primaryColor={activeTheme.leafPrimary}
              secondaryColor={activeTheme.leafSecondary}
              lightColor={activeTheme.leafLight}
            />
          </div>

          {/* Side Fern Leaf Sprouting Right Margin */}
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-8 h-12 z-20 transform scale-x-[-1] pointer-events-none">
            <FernFrond
              primaryColor={activeTheme.leafPrimary}
              secondaryColor={activeTheme.leafSecondary}
              lightColor={activeTheme.leafLight}
            />
          </div>

          {/* QR Image Strictly Inside Clean Quiet Zone */}
          {dataUrl ? (
            <img
              src={dataUrl}
              alt={isGeneral ? "Menu QR Code" : `Table ${tableNumber} QR Code`}
              className="w-44 h-44 sm:w-48 sm:h-48 object-contain rounded-lg relative z-10"
            />
          ) : (
            <div className="w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center bg-black/5 rounded-lg animate-pulse">
              <span className="text-xs" style={{ color: activeTheme.textSub }}>
                Generating QR...
              </span>
            </div>
          )}
        </div>

        {/* Clear Call to Action */}
        <div className="space-y-1">
          <h4
            className="font-serif font-bold text-base sm:text-lg tracking-wide"
            style={{ color: activeTheme.textHeading }}
          >
            Scan to order
          </h4>
          <p
            className="text-[11px] leading-tight max-w-[210px] mx-auto"
            style={{ color: activeTheme.textBody }}
          >
            Point your camera to view menu & place your order directly from your table.
          </p>

          {/* Micro-steps Guide */}
          <div
            style={{
              backgroundColor: activeTheme.stepsBg,
              borderColor: activeTheme.stepsBorder,
              color: activeTheme.stepsText,
            }}
            className="mt-1.5 py-1 px-2.5 rounded-md text-[10px] font-medium border inline-flex items-center gap-1 shadow-2xs"
          >
            <span>① Scan Code</span>
            <span>•</span>
            <span>② Pick Dishes</span>
            <span>•</span>
            <span>③ Served to Table</span>
          </div>
        </div>

        {/* Card Footer (Clean Branding Note, NO visible URL text) */}
        <div className="pt-2 border-t border-black/10 w-full text-center">
          <p
            className="text-[9px] uppercase tracking-wider font-semibold opacity-85"
            style={{ color: activeTheme.textSub }}
          >
            {restaurantName} • Table Service
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Offscreen Canvas Renderer for 1200x1680 High-Resolution Botanical Fern Poster PNG
 * Matching the reference image:
 * - Rich forest-green modules (#153C22)
 * - Pale mint paper background (#EFF5EE)
 * - Botanical fern fronds sprouting around the QR code and finder squares
 * - NO visible URL text at bottom
 */
async function renderBotanicalCardToCanvas(options: {
  restaurantName: string;
  tableNumber?: string;
  url: string;
  tagline?: string;
  theme?: ThemeOption;
}): Promise<string> {
  const {
    restaurantName,
    tableNumber,
    url,
    tagline = "Artisanal Roastery & Café",
    theme = "mint",
  } = options;

  const activeTheme = THEMES[theme] || THEMES.mint;
  const isGeneral = !tableNumber;

  // 1. Generate dark-green high-contrast QR matrix (600x600px with errorCorrection 'H')
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 600,
    margin: 2,
    color: { dark: activeTheme.qrDark, light: activeTheme.qrLight },
    errorCorrectionLevel: "H",
  });

  const qrImg = new Image();
  qrImg.src = qrDataUrl;
  await new Promise((resolve, reject) => {
    qrImg.onload = resolve;
    qrImg.onerror = reject;
  });

  // 2. Setup 1200x1680 300DPI Canvas
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1680;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // A. Background Pale Mint / Cream
  ctx.fillStyle = activeTheme.cardBg;
  ctx.fillRect(0, 0, 1200, 1680);

  // B. Double Hairline Botanical Frame
  // Outer Border
  ctx.strokeStyle = activeTheme.outerBorder;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(40, 40, 1120, 1600, 36);
  ctx.stroke();

  // Inner Border
  ctx.strokeStyle = activeTheme.innerBorder;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(58, 58, 1084, 1564, 26);
  ctx.stroke();

  // Helper functions for drawing realistic botanical fern fronds on canvas
  const drawLeaf = (cx: number, cy: number, angle: number, size: number, color: string) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(size * 0.45, size * 0.55, 0, size);
    ctx.quadraticCurveTo(-size * 0.45, size * 0.55, 0, 0);
    ctx.fill();
    ctx.restore();
  };

  const drawFernFrondCanvas = (
    startX: number,
    startY: number,
    angle: number,
    length: number,
    primaryColor: string,
    secondaryColor: string,
    lightColor: string
  ) => {
    ctx.save();
    ctx.translate(startX, startY);
    ctx.rotate(angle);

    // Main curving rachis
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(length * 0.35, length * 0.15, length, length * 0.65);
    ctx.stroke();

    // Leaflets along stem
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const lx = t * length;
      const ly = t * length * 0.65 * t;
      const leafSize = 28 - i * 2.2;
      drawLeaf(lx, ly, -Math.PI / 3.2, leafSize, primaryColor);
      drawLeaf(lx, ly, Math.PI / 3.2, leafSize, i % 2 === 0 ? secondaryColor : lightColor);
    }
    ctx.restore();
  };

  // C. Four Outer Corner Ferns
  drawFernFrondCanvas(65, 65, Math.PI * 0.08, 150, activeTheme.leafPrimary, activeTheme.leafSecondary, activeTheme.leafLight);
  drawFernFrondCanvas(1135, 65, Math.PI * 0.42, 150, activeTheme.leafPrimary, activeTheme.leafSecondary, activeTheme.leafLight);
  drawFernFrondCanvas(65, 1615, -Math.PI * 0.42, 150, activeTheme.leafPrimary, activeTheme.leafSecondary, activeTheme.leafLight);
  drawFernFrondCanvas(1135, 1615, -Math.PI * 0.92, 150, activeTheme.leafPrimary, activeTheme.leafSecondary, activeTheme.leafLight);

  // D. Integrated Fern Fronds Sprouting Around the 3 Finder Pattern Squares & QR Edges (matching reference image)
  // Top-Left Finder Pattern Fronds (sprouting into quiet zone corners)
  drawFernFrondCanvas(285, 395, -Math.PI * 0.65, 100, activeTheme.leafPrimary, activeTheme.leafSecondary, activeTheme.leafLight);
  drawFernFrondCanvas(285, 430, -Math.PI * 0.85, 80, activeTheme.leafSecondary, activeTheme.leafLight, activeTheme.leafPrimary);

  // Top-Right Finder Pattern Fronds
  drawFernFrondCanvas(915, 395, -Math.PI * 0.35, 100, activeTheme.leafPrimary, activeTheme.leafSecondary, activeTheme.leafLight);
  drawFernFrondCanvas(915, 430, -Math.PI * 0.15, 80, activeTheme.leafSecondary, activeTheme.leafLight, activeTheme.leafPrimary);

  // Bottom-Left Finder Pattern Fronds
  drawFernFrondCanvas(285, 1015, Math.PI * 0.65, 100, activeTheme.leafPrimary, activeTheme.leafSecondary, activeTheme.leafLight);
  drawFernFrondCanvas(285, 980, Math.PI * 0.85, 80, activeTheme.leafSecondary, activeTheme.leafLight, activeTheme.leafPrimary);

  // Right-Edge Perimeter Sprouting Fern
  drawFernFrondCanvas(915, 700, 0, 90, activeTheme.leafPrimary, activeTheme.leafSecondary, activeTheme.leafLight);

  // E. Header Section
  ctx.textAlign = "center";

  // Tagline
  ctx.font = "600 20px 'Plus Jakarta Sans', sans-serif";
  ctx.fillStyle = activeTheme.textSub;
  ctx.fillText(`🌿  ${tagline.toUpperCase()}  🌿`, 600, 155);

  // Main Café Heading
  ctx.font = "bold 50px 'Playfair Display', Georgia, serif";
  ctx.fillStyle = activeTheme.textHeading;
  ctx.fillText(restaurantName.toUpperCase(), 600, 225);

  // Decorative Horizontal Vine
  ctx.strokeStyle = activeTheme.innerBorder;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(350, 260);
  ctx.lineTo(850, 260);
  ctx.stroke();
  drawLeaf(600, 260, -Math.PI / 2, 16, activeTheme.leafPrimary);

  // Table Pill Badge
  ctx.fillStyle = activeTheme.pillBg;
  ctx.strokeStyle = activeTheme.pillBorder;
  ctx.lineWidth = 2;
  const pillW = isGeneral ? 440 : 340;
  const pillX = 600 - pillW / 2;
  ctx.beginPath();
  ctx.roundRect(pillX, 290, pillW, 68, 34);
  ctx.fill();
  ctx.stroke();

  ctx.font = "bold 28px 'JetBrains Mono', monospace";
  ctx.fillStyle = activeTheme.textHeading;
  ctx.fillText(isGeneral ? "COUNTER / MAIN MENU" : `TABLE ${tableNumber}`, 600, 335);

  // F. High-Contrast White QR Box (Generous Blank Quiet Zone)
  // Dimensions: 620 x 620 px
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(290, 395, 620, 620, 32);
  ctx.fill();
  ctx.stroke();

  // Draw Dark-Green QR Code strictly inside the quiet zone (540x540px)
  ctx.drawImage(qrImg, 330, 435, 540, 540);

  // G. "Scan to order" Call to Action
  ctx.font = "bold 48px 'Playfair Display', Georgia, serif";
  ctx.fillStyle = activeTheme.textHeading;
  ctx.fillText("Scan to order", 600, 1100);

  ctx.font = "500 24px 'Plus Jakarta Sans', sans-serif";
  ctx.fillStyle = activeTheme.textBody;
  ctx.fillText("Point your camera to view menu & place your order", 600, 1150);

  // H. Three-Step Micro Guide Pill
  ctx.fillStyle = activeTheme.stepsBg;
  ctx.strokeStyle = activeTheme.stepsBorder;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(240, 1205, 720, 68, 18);
  ctx.fill();
  ctx.stroke();

  ctx.font = "600 20px 'Plus Jakarta Sans', sans-serif";
  ctx.fillStyle = activeTheme.stepsText;
  ctx.fillText("① Scan Code   •   ② Pick Dishes   •   ③ Served to Table", 600, 1248);

  // I. Card Footer (Clean Branding Note, NO visible URL text)
  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(250, 1470);
  ctx.lineTo(950, 1470);
  ctx.stroke();

  ctx.font = "500 20px 'Plus Jakarta Sans', sans-serif";
  ctx.fillStyle = activeTheme.textSub;
  ctx.fillText(`${restaurantName}  •  Freshly Crafted Table Service  •  Complimentary Wi-Fi`, 600, 1530);

  return canvas.toDataURL("image/png");
}

export default function QRPage() {
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [theme, setTheme] = useState<ThemeOption>(() => {
    return (localStorage.getItem(QR_THEME_KEY) as ThemeOption) || "mint";
  });
  const [tables, setTables] = useState<TableEntry[]>(() => {
    try {
      const saved = localStorage.getItem(QR_TABLES_KEY);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [
      { id: "1", number: "1" },
      { id: "2", number: "2" },
      { id: "3", number: "3" },
      { id: "4", number: "4" },
      { id: "5", number: "5" },
    ];
  });
  const [newTable, setNewTable] = useState("");
  const [publicBaseUrl, setPublicBaseUrl] = useState(() => {
    return localStorage.getItem(QR_BASE_URL_KEY) || window.location.origin;
  });
  const [urlSavedNotice, setUrlSavedNotice] = useState(false);
  const [downloadingBatch, setDownloadingBatch] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {});
  }, []);

  const handleBaseUrlChange = (val: string) => {
    setPublicBaseUrl(val);
    localStorage.setItem(QR_BASE_URL_KEY, val);
    setUrlSavedNotice(true);
    setTimeout(() => setUrlSavedNotice(false), 2000);
  };

  const handleThemeChange = (newTheme: ThemeOption) => {
    setTheme(newTheme);
    localStorage.setItem(QR_THEME_KEY, newTheme);
  };

  const getMenuUrl = (table?: string) => {
    let cleanBase = publicBaseUrl.trim();
    if (!cleanBase) cleanBase = window.location.origin;
    if (!cleanBase.endsWith("/")) cleanBase += "/";
    return table ? `${cleanBase}?table=${encodeURIComponent(table)}` : cleanBase;
  };

  const restaurantName = settings?.restaurantName ?? "Kusum Kunja Café";
  const tagline = settings?.tagline ?? "Artisanal Roastery & Café";

  const addTable = () => {
    const num = newTable.trim();
    if (!num || tables.some((t) => t.number === num)) return;
    const updated = [...tables, { id: String(Date.now()), number: num }];
    setTables(updated);
    localStorage.setItem(QR_TABLES_KEY, JSON.stringify(updated));
    setNewTable("");
  };

  const removeTable = (id: string) => {
    const updated = tables.filter((t) => t.id !== id);
    setTables(updated);
    localStorage.setItem(QR_TABLES_KEY, JSON.stringify(updated));
  };

  // Download high-resolution botanical PNG card for a single table
  const downloadCardPNG = async (tableNumber?: string) => {
    const url = getMenuUrl(tableNumber);
    try {
      const dataUrl = await renderBotanicalCardToCanvas({
        restaurantName,
        tableNumber,
        url,
        tagline,
        theme,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = tableNumber
        ? `the-golden-brew-table-${tableNumber}-card.png`
        : `the-golden-brew-general-menu-card.png`;
      a.click();
    } catch (err) {
      console.error("Failed to render card PNG:", err);
      alert("Failed to render card image. Please try again.");
    }
  };

  // Download raw dark-green QR code PNG
  const downloadRawQR = async (tableNumber?: string) => {
    const url = getMenuUrl(tableNumber);
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 1024,
        margin: 2,
        color: { dark: THEMES[theme].qrDark, light: "#FFFFFF" },
        errorCorrectionLevel: "H",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = tableNumber
        ? `the-golden-brew-table-${tableNumber}-qr.png`
        : `the-golden-brew-menu-qr.png`;
      a.click();
    } catch (err) {
      console.error("Failed to download raw QR:", err);
    }
  };

  // Batch download high-res PNG cards for all tables
  const downloadAllCardsBatch = async () => {
    try {
      setDownloadingBatch(true);
      for (const table of tables) {
        await downloadCardPNG(table.number);
        await new Promise((r) => setTimeout(r, 250));
      }
    } finally {
      setDownloadingBatch(false);
    }
  };

  // Download Multi-Card PDF Sheet using jsPDF (A4 4-up with cut lines)
  const downloadMultiCardSheetPDF = async () => {
    try {
      setGeneratingPdf(true);
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const cardW = 90;
      const cardH = 126;
      const marginX = 10;
      const marginY = 16;
      const gapX = 10;
      const gapY = 12;

      let currentPage = 1;

      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        const pageIndex = i % 4;

        if (i > 0 && pageIndex === 0) {
          doc.addPage();
          currentPage++;
        }

        const col = pageIndex % 2;
        const row = Math.floor(pageIndex / 2);

        const x = marginX + col * (cardW + gapX);
        const y = marginY + row * (cardH + gapY);

        if (pageIndex === 0) {
          doc.setFont("times", "bold");
          doc.setFontSize(10);
          doc.setTextColor(20, 60, 35);
          doc.text(
            `${restaurantName} — Botanical Table QR Cards Sheet (A4 Cut-Ready • Page ${currentPage})`,
            105,
            10,
            { align: "center" }
          );
        }

        const cardPng = await renderBotanicalCardToCanvas({
          restaurantName,
          tableNumber: table.number,
          url: getMenuUrl(table.number),
          tagline,
          theme,
        });

        doc.addImage(cardPng, "PNG", x, y, cardW, cardH);

        doc.setDrawColor(180, 200, 185);
        doc.setLineWidth(0.3);
        doc.setLineDashPattern([2, 2], 0);
        doc.rect(x - 1, y - 1, cardW + 2, cardH + 2);
      }

      doc.save("the-golden-brew-table-qr-cards-sheet.pdf");
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF sheet. Please try again.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePrintSheet = () => {
    window.print();
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Page Title & Botanical Tagline */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <Leaf className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground">
                  Botanical Fern Table QR Cards
                </h2>
                <Badge className="bg-emerald-700 text-white border-0 text-[10px] font-semibold">
                  Fern Botanical Edition
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Printable table cards with integrated fern fronds, rich forest-green QR modules, and no visible URL text.
              </p>
            </div>
          </div>
        </div>

        {/* Global Batch Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintSheet}
            className="text-xs gap-1.5"
            title="Open browser print preview with cut guidelines"
          >
            <Printer size={14} /> Print Cards Sheet
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={downloadMultiCardSheetPDF}
            disabled={generatingPdf}
            className="text-xs gap-1.5 text-emerald-800 dark:text-emerald-300 border-emerald-600/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
          >
            <FileText size={14} />
            {generatingPdf ? "Compiling PDF..." : "Download Sheet (PDF)"}
          </Button>

          <Button
            size="sm"
            onClick={downloadAllCardsBatch}
            disabled={downloadingBatch}
            className="text-xs gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white"
          >
            <Download size={14} />
            {downloadingBatch ? "Downloading..." : "Download All (PNGs)"}
          </Button>
        </div>
      </div>

      {/* Style & Hostname Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Public Ingress Hostname Config */}
        <div className="md:col-span-2 bg-card rounded-2xl border border-border p-5 space-y-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <Globe className="text-emerald-700 dark:text-emerald-400" size={17} />
            <h3 className="text-sm font-semibold text-foreground">
              Configured Public HTTPS Hostname
            </h3>
            {urlSavedNotice && (
              <span className="flex items-center text-xs text-emerald-600 gap-1 ml-auto font-medium">
                <Check size={14} /> Saved
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Guests on mobile data (4G/5G) require your stable public HTTPS domain (e.g. Cloudflare
            Tunnel <code>https://menu.yourcafe.com</code>). This address is encoded directly into
            the QR code.
          </p>
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://menu.yourcafe.com"
              value={publicBaseUrl}
              onChange={(e) => handleBaseUrlChange(e.target.value)}
              className="font-mono text-xs h-9"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBaseUrlChange(window.location.origin)}
              title="Reset to current browser origin"
              className="h-9 text-xs"
            >
              Reset to Origin
            </Button>
          </div>
        </div>

        {/* Botanical Background Theme Selector */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <Layers className="text-emerald-700 dark:text-emerald-400" size={17} />
            <h3 className="text-sm font-semibold text-foreground">Paper Background</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Select paper tone for printable cards:
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleThemeChange("mint")}
              className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                theme === "mint"
                  ? "border-emerald-600 ring-2 ring-emerald-600/30 bg-[#EFF5EE] text-[#143022]"
                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-[#E5EFE2] border border-[#194326]/40 shrink-0" />
              <div className="text-xs font-semibold">Pale Mint</div>
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange("cream")}
              className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                theme === "cream"
                  ? "border-emerald-700 ring-2 ring-emerald-700/30 bg-[#FAF6EE] text-[#163425]"
                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-[#FAF3E4] border border-[#244530]/40 shrink-0" />
              <div className="text-xs font-semibold">Warm Cream</div>
            </button>
          </div>
        </div>
      </div>

      {/* General Counter / Takeaway Card Preview */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row items-center gap-8">
          <div className="shrink-0 flex justify-center">
            <BotanicalQRCard
              url={getMenuUrl()}
              restaurantName={restaurantName}
              tagline={tagline}
              theme={theme}
            />
          </div>

          <div className="flex-1 space-y-3 text-center lg:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
              <Sparkles size={13} />
              Entrance & Counter Edition
            </div>
            <h3 className="text-xl font-serif font-bold text-foreground">
              General Menu Poster Card
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-lg leading-relaxed">
              Place this card at the entrance, hostess desk, takeaway pick-up counter, or bar.
              Guests who scan this code browse the full digital menu without an assigned table.
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <Button
                onClick={() => downloadCardPNG()}
                className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs gap-1.5"
              >
                <Download size={14} /> Download Poster Card (PNG)
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadRawQR()}
                className="text-xs gap-1.5"
              >
                Download QR Matrix Only
              </Button>
              <a
                href={getMenuUrl()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-emerald-800 dark:text-emerald-400 font-semibold hover:underline ml-2"
              >
                <ExternalLink size={13} /> Test Link in Browser
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Table Cards Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-serif font-bold text-foreground">
              Individual Table Cards
            </h3>
            <p className="text-xs text-muted-foreground">
              Each code embeds <code>?table={"{number}"}</code> so customer orders are automatically
              assigned to their exact table session.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Table #"
              value={newTable}
              onChange={(e) => setNewTable(e.target.value)}
              className="w-28 h-9 text-xs"
              onKeyDown={(e) => e.key === "Enter" && addTable()}
            />
            <Button size="sm" onClick={addTable} className="text-xs gap-1 h-9">
              <Plus size={14} /> Add Table
            </Button>
          </div>
        </div>

        {/* Responsive Grid of Table Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {tables.map((t) => (
            <div
              key={t.id}
              className="bg-card rounded-2xl border border-border p-4 flex flex-col items-center gap-4 relative group shadow-2xs hover:shadow-md transition-shadow"
            >
              {/* Delete Button */}
              <button
                onClick={() => removeTable(t.id)}
                className="absolute top-3 right-3 text-muted-foreground hover:text-destructive opacity-40 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-destructive/10 z-20"
                title={`Remove Table ${t.number}`}
              >
                <Trash2 size={15} />
              </button>

              {/* Botanical Card Display */}
              <BotanicalQRCard
                tableNumber={t.number}
                url={getMenuUrl(t.number)}
                restaurantName={restaurantName}
                tagline={tagline}
                theme={theme}
                size="compact"
              />

              {/* Action Buttons for Table Card */}
              <div className="w-full space-y-1.5 pt-1">
                <Button
                  size="sm"
                  onClick={() => downloadCardPNG(t.number)}
                  className="w-full text-xs gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium"
                >
                  <Download size={13} /> Download Table Card (PNG)
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => downloadRawQR(t.number)}
                  >
                    QR Matrix Only
                  </Button>
                  <a
                    href={getMenuUrl(t.number)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground text-xs inline-flex items-center justify-center hover:bg-muted transition-colors"
                    title={`Test Table ${t.number} link`}
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/* HIDDEN IN BROWSER, ACTIVE ONLY ON NATIVE PRINT (Ctrl+P)    */}
      {/* ========================================================= */}
      <div
        id="printable-botanical-sheet"
        className="hidden print:block print:w-full print:bg-white"
      >
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-botanical-sheet, #printable-botanical-sheet * {
                visibility: visible !important;
              }
              #printable-botanical-sheet {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                display: block !important;
                background: white !important;
                margin: 0 !important;
                padding: 12mm 8mm !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .print-grid {
                display: grid !important;
                grid-template-columns: repeat(2, 1fr) !important;
                gap: 12mm !important;
              }
              .print-card-wrapper {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                position: relative !important;
                padding: 4mm !important;
                border: 1px dashed #A2BFA8 !important;
                border-radius: 12px !important;
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
              }
              @page {
                size: A4 portrait;
                margin: 8mm;
              }
            }
          `
        }} />

        <div className="text-center pb-4 mb-4 border-b border-gray-300">
          <h1 className="text-base font-bold font-serif text-[#143022]">
            {restaurantName} — Printable Table QR Cards Sheet
          </h1>
          <p className="text-[10px] text-gray-500">
            Cut along the dotted guidelines. Scan-tested with smartphone cameras at standard table distance.
          </p>
        </div>

        <div className="print-grid">
          {tables.map((t) => (
            <div key={t.id} className="print-card-wrapper">
              <div className="absolute top-1 left-2 flex items-center gap-1 text-[8px] text-gray-400">
                <Scissors size={10} /> Cut along line
              </div>
              <BotanicalQRCard
                tableNumber={t.number}
                url={getMenuUrl(t.number)}
                restaurantName={restaurantName}
                tagline={tagline}
                theme={theme}
                size="compact"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
