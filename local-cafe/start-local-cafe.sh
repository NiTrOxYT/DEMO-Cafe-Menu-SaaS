#!/usr/bin/env bash
# ==============================================================================
# One-Command Startup Script for Local Café QR Menu System (Linux & macOS)
# Supported Public HTTPS Ingress: Cloudflare Tunnel
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================================================="
echo " Starting Local Café QR Menu SaaS (Cloudflare Tunnel Deployment)"
echo "=========================================================================="

# ------------------------------------------------------------------------------
# 1. Check Docker Prerequisites
# ------------------------------------------------------------------------------
echo "[1/5] Checking Docker installation and daemon..."

if ! command -v docker >/dev/null 2>&1; then
  echo ""
  echo "[-] ERROR: 'docker' command was not found."
  echo "    Docker must be installed separately on this device before running this script."
  echo "    - Ubuntu/Debian: sudo apt-get install docker-ce docker-compose-plugin"
  echo "    - macOS: Install Docker Desktop from https://www.docker.com/products/docker-desktop/"
  echo "    See local-cafe/README.md for complete installation instructions."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo ""
  echo "[-] ERROR: Docker daemon is not running."
  echo "    Please start the Docker service or launch Docker Desktop, then retry:"
  echo "    - Linux: sudo systemctl start docker"
  echo "    - macOS: Open Docker Desktop application"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo ""
  echo "[-] ERROR: 'docker compose' plugin is not available."
  echo "    Please install the Docker Compose plugin (docker-compose-plugin)."
  exit 1
fi

echo "[+] Docker daemon and 'docker compose' are available."

# ------------------------------------------------------------------------------
# 2. Environment Configuration (.env) Setup
# ------------------------------------------------------------------------------
echo "[2/5] Checking environment configuration (.env)..."

if [ ! -f ".env" ]; then
  if [ ! -f ".env.example" ]; then
    echo "[-] ERROR: Neither .env nor .env.example was found in $SCRIPT_DIR."
    exit 1
  fi

  echo "    .env file does not exist. Creating .env from .env.example..."

  # Generate cryptographically secure random values without printing them
  if command -v openssl >/dev/null 2>&1; then
    GEN_PG_PASS="$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)"
    GEN_JWT="$(openssl rand -hex 32)"
  else
    GEN_PG_PASS="$(head -c 64 /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 24)"
    GEN_JWT="$(head -c 64 /dev/urandom | tr -dc 'a-f0-9' | head -c 64)"
  fi

  # Safely populate .env with awk (POSIX-portable across Linux and macOS)
  awk -v pass="$GEN_PG_PASS" -v jwt="$GEN_JWT" '
    /^POSTGRES_PASSWORD=/ { print "POSTGRES_PASSWORD=" pass; next }
    /^JWT_SECRET=/ { print "JWT_SECRET=" jwt; next }
    { print }
  ' .env.example > .env

  # Apply restrictive file permissions where supported
  chmod 600 .env 2>/dev/null || true
  echo "[+] Created .env with auto-generated POSTGRES_PASSWORD and JWT_SECRET (chmod 600)."
else
  echo "[+] Existing .env file found (preserved without overwriting)."
fi

# ------------------------------------------------------------------------------
# 3. Cloudflare Tunnel Token & Placeholder Validation
# ------------------------------------------------------------------------------
echo "[3/5] Validating secrets and Cloudflare Tunnel token..."

# Function to extract variable value from .env
get_env_val() {
  local key="$1"
  grep -E "^${key}=" .env 2>/dev/null | head -n 1 | cut -d '=' -f2- | tr -d '\r"' || true
}

CURRENT_TOKEN="$(get_env_val "CLOUDFLARE_TUNNEL_TOKEN")"

# Check if token is missing, empty, or still a placeholder
if [ -z "$CURRENT_TOKEN" ] || [[ "$CURRENT_TOKEN" == *"replace_with"* ]] || [[ "$CURRENT_TOKEN" == *"placeholder"* ]]; then
  echo ""
  echo "=========================================================================="
  echo " Cloudflare Tunnel Setup Required"
  echo "=========================================================================="
  echo "To enable public HTTPS access for customer QR scanning over mobile data,"
  echo "you must configure a tunnel in Cloudflare Zero Trust first:"
  echo ""
  echo " 1. Log in to Cloudflare Zero Trust (https://one.dash.cloudflare.com/)"
  echo " 2. Navigate to Networks -> Tunnels -> Create a Tunnel"
  echo " 3. Name your tunnel (e.g. 'cafe-server') and select 'cloudflared'"
  echo " 4. Under 'Public Hostname', add your domain (e.g. menu.yourcafe.com) and"
  echo "    route it to Service: HTTP -> frontend:80"
  echo " 5. Copy the tunnel token provided in the installation step."
  echo "=========================================================================="
  echo ""
  
  echo -n "Enter your Cloudflare Tunnel Token (input hidden): "
  stty -echo 2>/dev/null || true
  read -r INPUT_TOKEN
  stty echo 2>/dev/null || true
  echo ""

  if [ -z "$INPUT_TOKEN" ] || [[ "$INPUT_TOKEN" == *"replace_with"* ]] || [[ "$INPUT_TOKEN" == *"placeholder"* ]]; then
    echo "[-] ERROR: A valid Cloudflare Tunnel token is required to start public access."
    echo "    Please create a tunnel in Cloudflare Zero Trust and re-run this script."
    exit 1
  fi

  # Store token in .env securely without printing it
  awk -v token="$INPUT_TOKEN" '
    /^CLOUDFLARE_TUNNEL_TOKEN=/ { print "CLOUDFLARE_TUNNEL_TOKEN=" token; next }
    { print }
  ' .env > .env.tmp && mv .env.tmp .env
  chmod 600 .env 2>/dev/null || true
  echo "[+] Cloudflare Tunnel token saved to .env."
fi

# Verify no remaining placeholder secrets in critical fields
CHECK_PG_PASS="$(get_env_val "POSTGRES_PASSWORD")"
CHECK_JWT="$(get_env_val "JWT_SECRET")"
CHECK_TOKEN="$(get_env_val "CLOUDFLARE_TUNNEL_TOKEN")"

has_placeholder() {
  local val="$1"
  local lower
  lower="$(echo "$val" | tr '[:upper:]' '[:lower:]')"
  if [[ "$lower" == *"replace_with"* ]] || [[ "$lower" == *"placeholder"* ]] || \
     [[ "$lower" == *"cafe_secure_pass"* ]] || [[ "$lower" == *"admin123"* ]] || \
     [[ "$lower" == *"change_in_production"* ]]; then
    return 0
  fi
  return 1
}

if has_placeholder "$CHECK_PG_PASS"; then
  echo "[-] ERROR: POSTGRES_PASSWORD in .env still contains a placeholder value."
  echo "    Refusing to start. Please provide a strong password in .env."
  exit 1
fi

if has_placeholder "$CHECK_JWT" || [ ${#CHECK_JWT} -lt 16 ]; then
  echo "[-] ERROR: JWT_SECRET in .env is missing, contains a placeholder, or is under 16 chars."
  echo "    Refusing to start. Generate one with: openssl rand -hex 32"
  exit 1
fi

if has_placeholder "$CHECK_TOKEN"; then
  echo "[-] ERROR: CLOUDFLARE_TUNNEL_TOKEN in .env contains a placeholder."
  echo "    Refusing to start. Supply a valid token from Cloudflare Zero Trust."
  exit 1
fi

echo "[+] Security check passed: No placeholder secrets detected."

# ------------------------------------------------------------------------------
# 4. Build and Start Docker Containers
# ------------------------------------------------------------------------------
echo "[4/5] Building and launching containers with Cloudflare Tunnel profile..."

if ! docker compose --profile tunnel up --build -d; then
  echo ""
  echo "[-] ERROR: 'docker compose' command failed to start."
  echo "    Recent container logs:"
  docker compose logs --tail=40 2>/dev/null || true
  exit 1
fi

# ------------------------------------------------------------------------------
# 5. Wait for Services to Become Healthy
# ------------------------------------------------------------------------------
echo "[5/5] Waiting for services to become healthy (timeout: 90s)..."

MAX_ATTEMPTS=30
ATTEMPT=0
ALL_HEALTHY=false

while [ "$ATTEMPT" -lt "$MAX_ATTEMPTS" ]; do
  ATTEMPT=$((ATTEMPT + 1))
  sleep 3

  DB_HEALTH="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' local_cafe_db 2>/dev/null || echo "missing")"
  BE_HEALTH="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' local_cafe_backend 2>/dev/null || echo "missing")"
  FE_HEALTH="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' local_cafe_frontend 2>/dev/null || echo "missing")"
  TUNNEL_STATUS="$(docker inspect --format='{{.State.Status}}' local_cafe_tunnel 2>/dev/null || echo "missing")"

  if [ "$DB_HEALTH" = "healthy" ] && [ "$BE_HEALTH" = "healthy" ] && [ "$FE_HEALTH" = "healthy" ] && [ "$TUNNEL_STATUS" = "running" ]; then
    ALL_HEALTHY=true
    break
  fi

  echo "    Waiting... (attempt $ATTEMPT/$MAX_ATTEMPTS: db=$DB_HEALTH, backend=$BE_HEALTH, frontend=$FE_HEALTH, tunnel=$TUNNEL_STATUS)"
done

if [ "$ALL_HEALTHY" != "true" ]; then
  echo ""
  echo "[-] ERROR: Services did not all reach 'healthy' state within 90 seconds."
  echo ""
  echo "Current container states:"
  docker compose ps
  echo ""
  echo "Recent container logs:"
  docker compose logs --tail=30 2>/dev/null || true
  exit 1
fi

PUBLIC_URL="$(get_env_val "PUBLIC_URL")"
[ -z "$PUBLIC_URL" ] && PUBLIC_URL="https://menu.yourcafe.com"

echo ""
echo "=========================================================================="
echo "  Local Café QR Menu SaaS is ONLINE and HEALTHY"
echo "=========================================================================="
echo " Service Status:"
echo "   * Database (PostgreSQL 16) : Healthy (Private internal network only)"
echo "   * Backend API & Realtime   : Healthy (Private internal network only)"
echo "   * Frontend Web Server      : Healthy (Port 80)"
echo "   * Cloudflare Tunnel        : Container running (Edge connectivity unverified - check Cloudflare Zero Trust dashboard or run 'docker compose logs tunnel')"
echo ""
echo " Next Steps for Café Setup:"
echo "   1. Ensure your public domain in Cloudflare Zero Trust routes to:"
echo "        Service: HTTP -> frontend:80"
echo "   2. Open your public domain in your browser:"
echo "        $PUBLIC_URL/admin/login"
echo "      (Or locally at: http://localhost:8080/admin/login)"
echo "   3. Complete the First-Run Setup Wizard to create the Master Admin account."
echo "   4. Configure restaurant details, create menu categories, and add items."
echo "   5. Navigate to /admin/qr to generate and print table QR codes."
echo "=========================================================================="
echo ""

