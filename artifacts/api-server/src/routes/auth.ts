import { Router } from "express";
import { LoginBody } from "../lib/api-zod";

const router = Router();

const ADMIN_EMAIL = "sourikaich7@gmail.com";
const ADMIN_PASSWORD = "sourik";

const sessions = new Set<string>();

function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

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

  const token = generateToken();
  sessions.add(token);

  res.cookie("admin_token", token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
  });

  res.json({ success: true, user: { email: ADMIN_EMAIL } });
});

router.post("/auth/logout", (req, res) => {
  const token = req.cookies?.admin_token;
  if (token) {
    sessions.delete(token);
  }
  res.clearCookie("admin_token");
  res.json({ success: true });
});

router.get("/auth/me", (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token || !sessions.has(token)) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ email: ADMIN_EMAIL });
});

export { sessions };
export default router;
