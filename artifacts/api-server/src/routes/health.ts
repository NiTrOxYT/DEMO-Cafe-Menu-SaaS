import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "../lib/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

export const handleHealth = async (_req: Request, res: Response) => {
  const timestamp = new Date().toISOString();
  try {
    await pool.query("SELECT 1");
    res.status(200).json({
      status: "ok",
      database: "ok",
      timestamp,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ err: errorMsg }, "Health check database ping failed");
    res.status(503).json({
      status: "error",
      database: "unavailable",
      timestamp,
    });
  }
};

router.get("/health", handleHealth);
router.get("/healthz", handleHealth);

export default router;
