import React from "react";
import { useListMenuItems, useListCategories } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function Menu() {
  const { data: items, isLoading: itemsLoading } = useListMenuItems({ available: true });
  const { data: categories, isLoading: categoriesLoading } = useListCategories();

  const isLoading = itemsLoading || categoriesLoading;

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Hero Section */}
      <section className="relative h-[60dvh] min-h-[400px] w-full flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/hero.jpg" 
            alt="The Golden Brew Interior" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
        </div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto flex flex-col items-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-5xl md:text-7xl lg:text-8xl font-serif text-white tracking-tight mb-6"
          >
            The Golden Brew
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="text-lg md:text-xl text-white/90 font-sans tracking-wide max-w-xl text-shadow-sm"
          >
            A quiet, warm neighbourhood café where every detail matters.
          </motion.p>
        </div>
      </section>

      {/* Menu Sections */}
      <main className="max-w-6xl mx-auto px-6 py-24 space-y-32">
        {isLoading ? (
          <div className="space-y-24">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-8">
                <Skeleton className="h-12 w-48 mx-auto" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {[1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className="h-[300px] w-full rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          categories?.sort((a, b) => a.sortOrder - b.sortOrder).map((category) => {
            const categoryItems = items?.filter(item => item.categoryId === category.id).sort((a, b) => a.sortOrder - b.sortOrder) || [];
            if (categoryItems.length === 0) return null;

            return (
              <section key={category.id} className="scroll-mt-24">
                <div className="text-center mb-16">
                  <h2 className="text-3xl md:text-4xl font-serif text-foreground">{category.name}</h2>
                  <div className="h-px w-24 bg-primary/30 mx-auto mt-6"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {categoryItems.map((item, index) => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                      className="group relative overflow-hidden rounded-2xl bg-card border border-card-border"
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                        {item.imageUrl ? (
                          <img 
                            src={item.imageUrl} 
                            alt={item.name} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                            <span className="font-serif italic text-2xl">No Image</span>
                          </div>
                        )}
                      </div>
                      <div className="p-6 md:p-8 absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                        <div className="flex justify-between items-end gap-4">
                          <div>
                            <h3 className="text-2xl font-serif text-white">{item.name}</h3>
                            {item.description && (
                              <p className="text-white/80 mt-2 line-clamp-2 text-sm max-w-[280px]">{item.description}</p>
                            )}
                          </div>
                          <div className="text-xl font-sans font-medium text-primary">
                            ${item.price.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </main>

      <footer className="bg-card py-16 text-center border-t border-card-border">
        <h2 className="font-serif text-2xl mb-4 text-foreground">The Golden Brew</h2>
        <p className="text-muted-foreground mb-8">Est. 2024</p>
      </footer>
    </div>
  );
}
