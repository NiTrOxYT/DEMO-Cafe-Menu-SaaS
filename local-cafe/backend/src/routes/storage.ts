import { Router, Request, Response } from "express";
import { upload } from "../lib/storage.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

// Standard multipart form file upload
router.post("/upload", requireAdmin, upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No image file provided." });
    return;
  }

  const url = `/uploads/${req.file.filename}`;
  res.json({
    url,
    filename: req.file.filename,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
});

// Presigned URL compatibility endpoint
router.post("/uploads/request-url", requireAdmin, (_req: Request, res: Response) => {
  res.json({
    uploadURL: "/api/storage/upload",
    method: "POST",
  });
});

export default router;

