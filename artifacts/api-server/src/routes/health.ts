import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const handleHealth = (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
};

router.get("/health", handleHealth);
router.get("/healthz", handleHealth);

export default router;
