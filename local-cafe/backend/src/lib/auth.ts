import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "";
const COOKIE_NAME = "admin_session";

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, 12);
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

export function signAdminToken(admin: { id: number; email: string }): string {
  return jwt.sign({ id: admin.id, email: admin.email, role: "admin" }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function verifyAdminToken(token: string): { id: number; email: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: number; email: string; role: string };
  } catch {
    return null;
  }
}

export function setAdminCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.USE_HTTPS === "true",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  });
}

export function clearAdminCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/, "");
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const payload = verifyAdminToken(token);
  if (!payload || payload.role !== "admin") {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  (req as any).admin = payload;
  next();
}

