import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),

      "@workspace/api-client-react": path.resolve(
        __dirname,
        "src/lib/api-client-react/src/index.ts",
      ),

      "@workspace/object-storage-web": path.resolve(
        __dirname,
        "src/lib/object-storage-web/src/index.ts",
      ),
    },
  },

  build: {
    outDir: "dist",
  },

  server: {
    host: "0.0.0.0",
    port: 3000,
  },
});
