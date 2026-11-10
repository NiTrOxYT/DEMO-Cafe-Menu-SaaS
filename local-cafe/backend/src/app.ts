import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import path from "path";
import authRoutes from "./routes/auth.js";
import menuRoutes from "./routes/menu.js";
import ordersRoutes from "./routes/orders.js";
import rewardsRoutes from "./routes/rewards.js";
import analyticsRoutes from "./routes/analytics.js";
import settingsRoutes from "./routes/settings.js";
import storageRoutes from "./routes/storage.js";
import healthRoutes from "./routes/health.js";
import sessionsRoutes from "./routes/sessions.js";
import offersRoutes from "./routes/offers.js";
import inventoryRoutes from "./routes/inventory.js";
import rawMaterialsRoutes from "./routes/rawMaterials.js";
import { UPLOAD_DIR } from "./lib/storage.js";

export function createApp() {
  const app = express();

  // Basic Middlewares
  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true, limit: "5mb" }));

  // Request logger
  if (process.env.NODE_ENV !== "test") {
    app.use(pinoHttp({
      autoLogging: {
        ignore: (req) => req.url?.startsWith("/api/health") || req.url?.startsWith("/uploads/"),
      },
    }));
  }

  // Static uploads directory serving
  app.use("/uploads", express.static(UPLOAD_DIR));

  // Mount API routes
  app.use("/api/auth", authRoutes);
  app.use("/api", menuRoutes);
  app.use("/api", offersRoutes);
  app.use("/api", inventoryRoutes);
  app.use("/api", rawMaterialsRoutes);
  app.use("/api", ordersRoutes);
  app.use("/api", sessionsRoutes);
  app.use("/api/rewards", rewardsRoutes);
  app.use("/api", analyticsRoutes);
  app.use("/api", settingsRoutes);
  app.use("/api/storage", storageRoutes);
  app.use("/api", healthRoutes);

  // 404 handler for API routes
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Endpoint not found" });
  });

  return app;
}

