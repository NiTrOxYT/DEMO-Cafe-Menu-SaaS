const PLACEHOLDER_PATTERNS = [
  "replace_with",
  "change_in_production",
  "your_password",
  "cafe_secure_pass",
  "example",
  "secret_token_key",
  "todo",
  "dummy",
  "placeholder",
  "admin123",
  "S0urik123",
];

export function validateEnvironment(): void {
  const jwt = process.env.JWT_SECRET || "";
  const dbUrl = process.env.DATABASE_URL || "";

  if (!jwt || jwt.trim() === "") {
    throw new Error("[SECURITY] FATAL: JWT_SECRET is required. Generate one with 'openssl rand -hex 32'.");
  }

  if (jwt.length < 16) {
    throw new Error("[SECURITY] FATAL: JWT_SECRET is too short (must be at least 16 characters).");
  }

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (jwt.toLowerCase().includes(pattern.toLowerCase())) {
      throw new Error(
        "[SECURITY] FATAL: Known placeholder or insecure default value detected in JWT_SECRET! You must supply a real, random secret in .env."
      );
    }
    if (dbUrl.toLowerCase().includes(pattern.toLowerCase())) {
      throw new Error(
        "[SECURITY] FATAL: Known placeholder or insecure default value detected in database credentials! You must supply a strong POSTGRES_PASSWORD in .env."
      );
    }
  }
}

