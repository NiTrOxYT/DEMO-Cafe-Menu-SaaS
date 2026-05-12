import { useState, useEffect } from "react";
import { useListMenuItems, useListCategories } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";

type MenuItem = {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  categoryId: number;
  categoryName?: string | null;
  available: boolean;
  sortOrder: number;
};

const DARK = "#0f0e0c";
const DARK_CARD = "#1c1a17";
const DARK_ELEVATED = "#252219";
const CREAM = "#f0ebe2";
const MUTED = "#7a7265";
const AMBER = "#c9a96e";
const AMBER_LIGHT = "#e8c98a";
const BORDER = "rgba(255,255,255,0.07)";

function formatINR(amount: number) {
  return `₹${Math.round(amount)}`;
}

function ItemDetailOverlay({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
        className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-8"
        onClick={onClose}
      >
        <motion.div
          key="panel"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 220 }}
          style={{ background: DARK_CARD, maxHeight: "92dvh" }}
          className="w-full md:max-w-3xl md:rounded-none overflow-hidden flex flex-col md:flex-row"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Image panel */}
          {item.imageUrl && (
            <div className="w-full md:w-1/2 aspect-[4/3] md:aspect-auto md:min-h-[480px] flex-shrink-0 overflow-hidden">
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Info panel */}
          <div
            className="flex-1 flex flex-col justify-between p-7 md:p-10 overflow-y-auto"
            style={{ background: DARK_CARD }}
          >
            <div>
              {/* Close */}
              <div className="flex justify-between items-start mb-8">
                {item.categoryName && (
                  <span
                    className="font-manrope text-[10px] uppercase tracking-[0.22em] font-semibold"
                    style={{ color: AMBER }}
                  >
                    {item.categoryName}
                  </span>
                )}
                <button
                  data-testid="button-close-detail"
                  onClick={onClose}
                  className="ml-auto text-[22px] leading-none transition-opacity hover:opacity-60"
                  style={{ color: CREAM, fontFamily: "Manrope" }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Name */}
              <h2
                className="font-garamond leading-[1.05] mb-2"
                style={{ fontSize: "clamp(32px, 5vw, 46px)", color: CREAM }}
              >
                {item.name}
              </h2>

              {/* Price */}
              <p
                className="font-garamond text-[28px] mb-6"
                style={{ color: AMBER }}
              >
                {formatINR(item.price)}
              </p>

              {/* Divider */}
              <div style={{ height: "1px", background: BORDER }} className="mb-6" />

              {/* Description */}
              {item.description ? (
                <p
                  className="font-manrope text-[15px] leading-[1.75]"
                  style={{ color: MUTED }}
                >
                  {item.description}
                </p>
              ) : (
                <p className="font-manrope text-[14px] italic" style={{ color: MUTED }}>
                  No description available.
                </p>
              )}
            </div>

            {/* Footer CTA area (view only) */}
            <div className="mt-10">
              <div
                className="w-full py-[1px]"
                style={{ background: BORDER }}
              />
              <p
                className="font-manrope text-[10px] uppercase tracking-[0.2em] text-center mt-5"
                style={{ color: MUTED }}
              >
                The Golden Brew — Est. 2024
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Menu() {
  const { data: items, isLoading: itemsLoading } = useListMenuItems({ available: true });
  const { data: categories, isLoading: categoriesLoading } = useListCategories();
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const isLoading = itemsLoading || categoriesLoading;

  const sortedCategories = categories
    ? [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  const filteredCategories =
    activeCategoryId !== null
      ? sortedCategories.filter((c) => c.id === activeCategoryId)
      : sortedCategories;

  return (
    <div style={{ background: DARK, color: CREAM, minHeight: "100dvh" }} className="font-manrope">

      {/* Subtle grain */}
      <div className="noise-overlay" style={{ opacity: 0.04 }} />

      {/* ── TOP NAV ────────────────────────────────── */}
      <nav
        className="fixed top-0 w-full z-40 flex justify-center items-center h-16"
        style={{
          background: `${DARK}ee`,
          backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <span
          className="font-garamond uppercase tracking-[0.22em] text-[18px]"
          style={{ color: CREAM, letterSpacing: "0.22em" }}
        >
          The Golden Brew
        </span>
      </nav>

      {/* ── HERO ───────────────────────────────────── */}
      <section className="relative h-[92dvh] min-h-[560px] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=2400&q=85"
          alt="The Golden Brew"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "brightness(0.38)" }}
        />

        {/* Gradient bottom fade */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, transparent 50%, ${DARK} 100%)`,
          }}
        />

        {/* Hero text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="font-manrope text-[10px] uppercase tracking-[0.3em] font-semibold mb-5 block"
            style={{ color: AMBER }}
          >
            Seasonal Selection · 2024
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.9 }}
            className="font-garamond leading-[1.0]"
            style={{
              fontSize: "clamp(64px, 12vw, 120px)",
              color: CREAM,
              letterSpacing: "-0.02em",
            }}
          >
            Our Menu
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.9 }}
            className="font-manrope text-[15px] leading-relaxed mt-6 max-w-md"
            style={{ color: "rgba(240,235,226,0.55)" }}
          >
            Each ingredient is hand-selected and prepared in small batches to preserve its character.
          </motion.p>

          {/* Scroll hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="absolute bottom-10 flex flex-col items-center gap-2"
          >
            <span className="font-manrope text-[10px] uppercase tracking-[0.25em]" style={{ color: MUTED }}>
              Scroll to explore
            </span>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
              style={{ width: 1, height: 28, background: `linear-gradient(to bottom, ${MUTED}, transparent)` }}
            />
          </motion.div>
        </div>
      </section>

      {/* ── STICKY CATEGORY BAR ────────────────────── */}
      <div
        className="sticky top-16 z-30 flex overflow-x-auto no-scrollbar justify-center"
        style={{
          background: `${DARK}f0`,
          backdropFilter: "blur(16px)",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div className="flex gap-0">
          {/* "All" tab */}
          <button
            data-testid="tab-all"
            onClick={() => setActiveCategoryId(null)}
            className="font-manrope text-[10px] uppercase tracking-[0.2em] font-semibold px-6 py-5 whitespace-nowrap transition-all duration-200"
            style={{
              color: activeCategoryId === null ? CREAM : MUTED,
              borderBottom: activeCategoryId === null ? `2px solid ${AMBER}` : "2px solid transparent",
            }}
          >
            All
          </button>
          {sortedCategories.map((cat) => {
            const active = activeCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                data-testid={`tab-category-${cat.id}`}
                onClick={() => setActiveCategoryId(active ? null : cat.id)}
                className="font-manrope text-[10px] uppercase tracking-[0.2em] font-semibold px-6 py-5 whitespace-nowrap transition-all duration-200"
                style={{
                  color: active ? CREAM : MUTED,
                  borderBottom: active ? `2px solid ${AMBER}` : "2px solid transparent",
                }}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MENU CONTENT ───────────────────────────── */}
      <main className="max-w-screen-xl mx-auto px-5 md:px-14 pt-20 pb-32">

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px" style={{ gap: "1px" }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ background: DARK_CARD }} className="animate-pulse">
                <div className="aspect-[4/3]" style={{ background: DARK_ELEVATED }} />
                <div className="p-7 space-y-3">
                  <div className="h-3 w-20 rounded" style={{ background: DARK_ELEVATED }} />
                  <div className="h-8 w-3/4 rounded" style={{ background: DARK_ELEVATED }} />
                  <div className="h-4 w-full rounded" style={{ background: DARK_ELEVATED }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Categories */}
        {!isLoading && filteredCategories.map((category, catIndex) => {
          const categoryItems = (items ?? [])
            .filter(i => i.categoryId === category.id)
            .sort((a, b) => a.sortOrder - b.sortOrder);

          if (categoryItems.length === 0) return null;

          return (
            <section key={category.id} className="mb-28 scroll-mt-36" id={`cat-${category.id}`}>

              {/* Category heading */}
              <motion.div
                className="flex items-center gap-6 mb-12"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex-1 h-px" style={{ background: BORDER }} />
                <h2
                  className="font-garamond text-[32px] md:text-[38px] leading-tight shrink-0"
                  style={{ color: CREAM }}
                >
                  {category.name}
                </h2>
                <div className="flex-1 h-px" style={{ background: BORDER }} />
              </motion.div>

              {/* Item grid — 2 col md, 3 col xl */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {categoryItems.map((item, index) => (
                  <motion.button
                    key={item.id}
                    data-testid={`card-item-${item.id}`}
                    className="group text-left overflow-hidden"
                    style={{ background: DARK_CARD }}
                    onClick={() => setSelectedItem(item)}
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.5, delay: index * 0.07 }}
                  >
                    {/* Image */}
                    <div className="aspect-[4/3] overflow-hidden relative">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ background: DARK_ELEVATED }}
                        >
                          <span className="font-garamond italic text-lg" style={{ color: MUTED }}>
                            No image
                          </span>
                        </div>
                      )}

                      {/* Hover overlay */}
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.45)" }}
                      >
                        <span
                          className="font-manrope text-[10px] uppercase tracking-[0.25em] font-semibold border px-5 py-3"
                          style={{ color: CREAM, borderColor: "rgba(255,255,255,0.35)" }}
                        >
                          View Details
                        </span>
                      </div>
                    </div>

                    {/* Text block */}
                    <div className="p-6">
                      <div className="flex justify-between items-start gap-3 mb-2">
                        <h3
                          className="font-garamond text-[24px] leading-tight"
                          style={{ color: CREAM }}
                        >
                          {item.name}
                        </h3>
                        <span
                          className="font-garamond text-[22px] leading-tight shrink-0"
                          style={{ color: AMBER }}
                        >
                          {formatINR(item.price)}
                        </span>
                      </div>

                      {item.description && (
                        <p
                          className="font-manrope text-[13px] leading-relaxed line-clamp-2 mt-1"
                          style={{ color: MUTED }}
                        >
                          {item.description}
                        </p>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {/* ── FOOTER ─────────────────────────────────── */}
      <footer
        className="text-center py-20 px-6"
        style={{ borderTop: `1px solid ${BORDER}` }}
      >
        <p
          className="font-garamond text-[11px] uppercase tracking-[0.3em] mb-4"
          style={{ color: AMBER }}
        >
          Est. 2024
        </p>
        <h2
          className="font-garamond text-[36px] mb-3"
          style={{ color: CREAM }}
        >
          The Golden Brew
        </h2>
        <p
          className="font-manrope text-[13px] leading-relaxed max-w-sm mx-auto"
          style={{ color: MUTED }}
        >
          A quiet place where every detail matters.
        </p>
        <div className="mt-10 flex justify-center">
          <div style={{ width: 40, height: 1, background: BORDER }} />
        </div>
      </footer>

      {/* ── ITEM DETAIL OVERLAY ─────────────────────── */}
      <AnimatePresence>
        {selectedItem && (
          <ItemDetailOverlay item={selectedItem} onClose={() => setSelectedItem(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
