import crypto from "crypto";

/**
 * Generates an unguessable 256-bit cryptographic order access capability token.
 */
export function generateOrderAccessToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = hashOrderAccessToken(token);
  return { token, hash };
}

/**
 * Hashes an order access token with SHA-256 for secure database storage.
 */
export function hashOrderAccessToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Verifies that a presented token matches the stored token hash.
 */
export function verifyOrderAccessToken(token: string, storedHash: string | null | undefined): boolean {
  if (!token || !storedHash) return false;
  const hash = hashOrderAccessToken(token);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
}

/**
 * Generates an unguessable 256-bit cryptographic guest session capability token.
 */
export function generateGuestToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = hashGuestToken(token);
  return { token, hash };
}

/**
 * Hashes a guest session token with SHA-256 for secure database storage.
 */
export function hashGuestToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Verifies that a presented guest token matches the stored guest token hash.
 */
export function verifyGuestToken(token: string, storedHash: string | null | undefined): boolean {
  if (!token || !storedHash) return false;
  const hash = hashGuestToken(token);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
}


