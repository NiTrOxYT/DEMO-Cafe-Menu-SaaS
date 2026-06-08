import { Router } from "express";
import { LoginBody } from "../lib/api-zod";

const router = Router();

const ADMIN_EMAIL = "twister.admin@gmail.com";
const ADMIN_PASSWORD = "admin123";

router.post("/auth/login", (req, res) => {
  const parsed = LoginBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { email, password } = parsed.data;

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("admin_token", "authenticated", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    user: { email: ADMIN_EMAIL },
  });
});

router.post("/auth/logout", (_req, res) => {
  const isProduction = process.env.NODE_ENV === "production";

  res.clearCookie("admin_token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });

  res.json({ success: true });
});

router.get("/auth/me", (req, res) => {
  const token = req.cookies?.admin_token;

  if (token !== "authenticated") {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json({
    email: ADMIN_EMAIL,
  });
});

export default router;
