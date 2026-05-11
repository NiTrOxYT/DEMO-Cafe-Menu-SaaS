import { useState } from "react";
import { useListMenuItems, useListCategories } from "@workspace/api-client-react";
import { motion } from "framer-motion";

function formatINR(amount: number) {
  return `₹${amount.toFixed(0)}`;
}

export default function Menu() {
  const { data: items, isLoading: itemsLoading } = useListMenuItems({ available: true });
  const { data: categories, isLoading: categoriesLoading } = useListCategories();
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);

  const isLoading = itemsLoading || categoriesLoading;

  const sortedCategories = categories
    ? [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  const activeCategory = activeCategoryId ?? sortedCategories[0]?.id ?? null;

  const filteredCategories = activeCategoryId
    ? sortedCategories.filter((c) => c.id === activeCategoryId)
    : sortedCategories;

  return (
    <div className="bg-background text-foreground" style={{ minHeight: "100dvh" }}>
      {/* Noise overlay */}
      <div className="noise-overlay" />

      {/* Top Navigation */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-5 md:px-16 h-20 border-b border-border/20 bg-background/90 backdrop-blur-md">
        <button className="active:scale-95 transition-transform duration-200" aria-label="Menu">
          <span className="material-symbols-outlined text-foreground">menu</span>
        </button>
        <h1
          className="font-garamond text-[20px] tracking-[0.18em] uppercase text-foreground"
          style={{ letterSpacing: "0.15em" }}
        >
          The Golden Brew
        </h1>
        <button className="active:scale-95 transition-transform duration-200" aria-label="Bag">
          <span className="material-symbols-outlined text-foreground">shopping_bag</span>
        </button>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-32 max-w-screen-xl mx-auto px-5 md:px-16">

        {/* Hero */}
        <header className="py-12 md:py-20 text-center">
          <span className="font-manrope text-[11px] uppercase tracking-[0.18em] font-semibold text-secondary mb-4 block">
            Seasonal Selection
          </span>
          <h2 className="font-garamond text-[56px] md:text-[80px] leading-[1.05] tracking-tight text-foreground mb-6">
            Our Menu
          </h2>
          <p className="max-w-xl mx-auto font-manrope text-[17px] leading-relaxed text-muted-foreground">
            Curated rituals for the modern connoisseur. Each ingredient is hand-selected and prepared in small batches to preserve its character.
          </p>
        </header>

        {/* Category Filter Tabs */}
        {!isLoading && sortedCategories.length > 0 && (
          <div className="flex overflow-x-auto no-scrollbar gap-8 mb-16 border-b border-border/20 pb-0 justify-center">
            {sortedCategories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  data-testid={`tab-category-${cat.id}`}
                  onClick={() => setActiveCategoryId(isActive && activeCategoryId !== null ? null : cat.id)}
                  className={[
                    "font-manrope text-[11px] uppercase tracking-[0.15em] font-semibold pb-4 whitespace-nowrap transition-colors duration-300 border-b-2",
                    isActive
                      ? "text-foreground border-secondary"
                      : "text-muted-foreground border-transparent hover:text-secondary",
                  ].join(" ")}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-24">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-10">
                <div className="h-10 w-52 mx-auto bg-muted animate-pulse rounded" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-24 gap-y-14">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="space-y-4">
                      <div className="aspect-[4/3] bg-muted animate-pulse" />
                      <div className="h-7 w-3/4 bg-muted animate-pulse rounded" />
                      <div className="h-4 w-full bg-muted animate-pulse rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Menu Sections */}
        {!isLoading &&
          filteredCategories.map((category, catIndex) => {
            const categoryItems =
              items
                ?.filter((item) => item.categoryId === category.id)
                .sort((a, b) => a.sortOrder - b.sortOrder) ?? [];

            if (categoryItems.length === 0) return null;

            const useGridLayout = catIndex % 2 === 0;

            return (
              <div key={category.id}>
                {catIndex > 0 && (
                  <div className="w-full h-px bg-border/20 mb-24" />
                )}

                <section className="mb-24 scroll-mt-28" id={`cat-${category.id}`}>
                  {/* Section heading — only shown if not the first (the hero acts as heading for first) */}
                  {catIndex > 0 && (
                    <motion.h2
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5 }}
                      className="font-garamond text-[36px] md:text-[44px] text-foreground mb-12 text-center leading-tight"
                    >
                      {category.name}
                    </motion.h2>
                  )}

                  {useGridLayout ? (
                    /* Grid layout: 2-column with images above text */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-20 gap-y-16">
                      {categoryItems.map((item, index) => (
                        <motion.div
                          key={item.id}
                          data-testid={`card-item-${item.id}`}
                          className="flex flex-col group"
                          initial={{ opacity: 0, y: 24 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: "-80px" }}
                          transition={{ duration: 0.55, delay: index * 0.08 }}
                        >
                          {/* Image */}
                          <div className="aspect-[4/3] mb-6 overflow-hidden bg-muted">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-card">
                                <span className="font-garamond italic text-muted-foreground text-xl">
                                  No image
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Name + Price */}
                          <div className="flex justify-between items-start mb-2 gap-4">
                            <h3 className="font-garamond text-[28px] leading-tight text-foreground">
                              {item.name}
                            </h3>
                            <span className="font-manrope text-[16px] font-semibold text-foreground shrink-0 mt-1">
                              {formatINR(item.price)}
                            </span>
                          </div>

                          {/* Description */}
                          {item.description && (
                            <p className="font-manrope text-[15px] text-muted-foreground mb-6 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    /* List layout: narrow centered list with add button */
                    <div className="max-w-2xl mx-auto space-y-0">
                      {categoryItems.map((item, index) => (
                        <motion.div
                          key={item.id}
                          data-testid={`list-item-${item.id}`}
                          className="flex items-start gap-8 border-b border-border/15 py-10"
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: "-60px" }}
                          transition={{ duration: 0.5, delay: index * 0.06 }}
                        >
                          {item.imageUrl && (
                            <div className="w-20 h-20 shrink-0 overflow-hidden bg-muted hidden sm:block">
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-2 gap-4">
                              <h3 className="font-garamond text-[26px] leading-tight text-foreground">
                                {item.name}
                              </h3>
                              <span className="font-manrope text-[16px] font-semibold text-foreground shrink-0">
                                {formatINR(item.price)}
                              </span>
                            </div>
                            {item.description && (
                              <p className="font-manrope text-[15px] text-muted-foreground leading-relaxed pr-4">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            );
          })}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/20 py-16 text-center bg-background">
        <h2 className="font-garamond text-[28px] text-foreground mb-2">The Golden Brew</h2>
        <p className="font-manrope text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
          Est. 2024
        </p>
      </footer>
    </div>
  );
}
