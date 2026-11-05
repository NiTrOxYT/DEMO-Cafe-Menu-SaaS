# Dedicated Server Deployment & Operations Guide
## Café QR Menu SaaS — One-Command Cloudflare Tunnel Deployment

This folder (`local-cafe/`) contains the self-hosted, dedicated server implementation of the Café Menu SaaS. It is hardened for a physical server located on-premises at the café, engineered to serve customers who scan table QR codes over public mobile data (4G/5G) as well as café Wi-Fi.

---

## 1. Architecture & Threat Model

```
                    ┌────────────────────────────────────────────────────────┐
                    │                 CUSTOMER DEVICES                       │
                    │   (Mobile Data 4G/5G & In-Café Wi-Fi)                  │
                    └─────────────────────────┬──────────────────────────────┘
                                              │ Public HTTPS
                                              ▼
                    ┌────────────────────────────────────────────────────────┐
                    │          SUPPORTED PUBLIC INGRESS METHOD               │
                    │                 Cloudflare Tunnel                      │
                    │           (Encrypted outbound tunnel)                  │
                    │     Terminates public HTTPS at Cloudflare edge         │
                    └─────────────────────────┬──────────────────────────────┘
                                              │ Outbound tunnel connection
                                              ▼
┌────────────────────────────────────── DOCKER HOST ──────────────────────────────────────┐
│  Linux / macOS / Windows with Docker (Wired Gigabit Ethernet Recommended)               │
│                                                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │ PUBLIC ENTRY POINT (Only port published on host)                                │   │
│   │                                                                                 │   │
│   │   local_cafe_frontend (Nginx Alpine + React 19 SPA)                             │   │
│   │   - Host Port 80 (HTTP / Ingress Target)                                        │   │
│   │   - Serves React SPA, static media (/uploads/), proxies /api & /socket.io       │   │
│   └───────────────────────────────┬─────────────────────────────────────────────────┘   │
│                                   │ Internal Docker Network                             │
│                                   │ (local_cafe_default)                                │
│                                   ▼                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │ PRIVATE BACKEND (No ports published to host or internet)                        │   │
│   │                                                                                 │   │
│   │   local_cafe_backend (Node.js 22 + Express 5 + Socket.IO)                       │   │
│   │   - Internal Port 5000 only                                                     │   │
│   │   - bcrypt auth, capability tokens, Multer local file storage                   │   │
│   └───────────────────────────────┬─────────────────────────────────────────────────┘   │
│                                   │ Internal Docker Network                             │
│                                   │ (local_cafe_default)                                │
│                                   ▼                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │ PRIVATE DATABASE (No ports published to host or internet)                       │   │
│   │                                                                                 │   │
│   │   local_cafe_db (PostgreSQL 16 Alpine)                                          │   │
│   │   - Internal Port 5432 only                                                     │   │
│   │   - Data persisted to named volume: cafe_pgdata                                 │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│   Named Volumes:                                                                        │
│   • cafe_pgdata     -> Persistent PostgreSQL database storage                           │
│   • cafe_media_data  -> Uploaded menu item images and café branding                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Security Hardening Measures
* **Zero Host Exposure for Database**: PostgreSQL port `5432` has **no host port mapping**. It is accessible strictly by containers on the internal Docker bridge network.
* **Private API Engine**: Express (`5000`) is unmapped to the host, shielded behind Nginx.
* **Strict Secret Enforcement & Validation**: Insecure fallback passwords and default JWT secrets are removed. Startup scripts inspect `.env` using pure shell checks and abort if any known placeholder secrets are detected.
* **Continuous Health Checks & Auto-Recovery**: All services configure automated health checks and `restart: always` to recover from process restarts or system reboot.
* **Local In-Browser QR Code Generation**: Table QR codes are generated directly in the browser via canvas/JavaScript without sending QR data or URLs to third-party APIs.

---

## 2. One-Command Automated Startup

For devices that already have **Docker** and **Docker Compose** installed, dedicated startup scripts automate environment generation, secret creation, tunnel validation, container builds, and health verification.

> [!IMPORTANT]
> **Prerequisite**: Docker Engine (with the Compose plugin) or Docker Desktop **must be installed separately on each machine** before running these scripts. The scripts do not install Docker itself.

### Linux / macOS: `start-local-cafe.sh`
```bash
cd local-cafe
chmod +x start-local-cafe.sh
./start-local-cafe.sh
```

### Windows (PowerShell): `start-local-cafe.ps1`
```powershell
cd local-cafe
.\start-local-cafe.ps1
```

### What the Startup Scripts Do Automatically:
1. **Pre-flight Check**: Verifies that `docker`, the Docker daemon, and `docker compose` are available and running.
2. **Safe `.env` Generation**: Creates `.env` from `.env.example` only if `.env` does not already exist (never overwrites existing configuration). Generates cryptographically secure, random 24-character `POSTGRES_PASSWORD` and 32-byte `JWT_SECRET` strings without printing them to logs, and restricts file permissions (`chmod 600 .env` on POSIX).
3. **Cloudflare Tunnel Token Prompt**: If the tunnel token is missing or a placeholder, prints Cloudflare dashboard setup instructions, prompts securely for the token with hidden input, and stores it in `.env`.
4. **Placeholder Validation**: Performs pure shell/PowerShell checks against known placeholder patterns (`replace_with`, `placeholder`, `cafe_secure_pass`, `admin123`) and refuses to start if unconfigured secrets remain. Does not require `tsx` or Node on the host.
5. **Container Build & Launch**: Executes `docker compose --profile tunnel up --build -d`.
6. **Health Loop**: Polls container health checks for up to 90 seconds. On success, prints service status and first-run steps. On failure, outputs container states and recent logs without exposing secrets.

---

## 3. Public Ingress Architecture

Customers seated at tables frequently scan QR codes using their mobile cellular data (4G/5G). Internal IP addresses (e.g. `192.168.1.50`) cannot be reached over cellular networks.

### Supported Method: Cloudflare Tunnel (Ready for Production)

Cloudflare Tunnel is the **official, supported public HTTPS access method** for this deployment.

* **How It Works**:
  * An outbound tunnel container (`cloudflared`) connects from the local Docker host to Cloudflare’s global network.
  * Cloudflare edge servers terminate SSL/TLS for your public hostname (e.g. `https://menu.yourcafe.com`) with automated certificates.
  * Cloudflare proxies clean HTTP traffic through the tunnel directly to `frontend:80` inside the internal Docker network.
  * No inbound router ports are opened, and your café's ISP IP is never exposed.
  * **Carrier-Grade NAT (CGNAT) Immune**: Works seamlessly even if your ISP uses CGNAT.
* **Manual Setup Steps in Cloudflare Dashboard**:
  1. In the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/), go to **Networks** $\rightarrow$ **Tunnels**.
  2. Click **Create a Tunnel** $\rightarrow$ Select **Cloudflared** $\rightarrow$ Name it (e.g., `cafe-server`).
  3. Copy the generated Tunnel Token string.
  4. In Cloudflare Tunnel settings under **Public Hostname**:
     * **Subdomain / Domain**: e.g. `menu.yourcafe.com`
     * **Service**: `HTTP` $\rightarrow$ `frontend:80`
  5. Provide the token when prompted by `./start-local-cafe.sh` or set `CLOUDFLARE_TUNNEL_TOKEN` in `.env`.

### Status of Direct Public IP Ingress: NOT YET SUPPORTED

> [!IMPORTANT]
> **Direct-to-Server Public IP Ingress is NOT supported out-of-the-box.**
> * The containerized Nginx service only listens on port 80 (HTTP) as an internal reverse proxy target for the tunnel.
> * It does not include a port 443 SSL listener, local TLS certificate volume mounts, or automated Certbot renewal pipelines.
> * Direct port forwarding on port 80 over the open internet without TLS is insecure for customer data, and forwarding port 443 will fail because no HTTPS server is listening.
> * If direct IP routing is required in the future, a separate fronting reverse proxy (such as host Nginx, Caddy, or Traefik with automated Let's Encrypt certificates) must be implemented. For the initial deployment, Cloudflare Tunnel must be used.

---

## 4. Manual Server Preparation (If Not Using Startup Scripts)

If you prefer to configure the server manually without the one-command startup script, follow these steps on a dedicated machine running **Ubuntu Server 24.04 LTS**.

### 4.1 Network & Sleep Settings
1. **Connect via Wired Gigabit Ethernet**: Ensure a CAT6 ethernet cable connects the server directly to the primary router or switch. Do not run the server on Wi-Fi.
2. **Assign a Static DHCP Reservation**: On your router, assign a fixed LAN IP to the server MAC address (e.g., `192.168.1.50`).
3. **Disable System Sleep & Hibernation**:
   Prevent Ubuntu Server from suspending or entering low-power sleep modes:
   ```bash
   sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
   ```
4. **Configure Automatic Reboot on Power Loss**: In computer BIOS/UEFI settings (pressing F2/Del on boot), set **AC Power Recovery / Restore on AC Power Loss** to **Always On** or **Power On**.

---

### 4.2 Install Official Docker Engine & Compose
Install Docker Engine following the official Docker repository for Ubuntu 24.04 LTS (Noble):

```bash
# Update package index and install prerequisites
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Add Docker official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository for Ubuntu 24.04 (noble)
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  noble stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker packages
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable Docker system service
sudo systemctl enable --now docker

# Add current user to docker group
sudo usermod -aG docker $USER
```

---

### 4.3 Configure Secrets & Launch Manually
```bash
cd local-cafe
cp .env.example .env

# Generate a strong 32-byte JWT secret
openssl rand -hex 32
```

Edit `.env` using `nano .env`:
* Set `POSTGRES_USER` (e.g. `cafe_admin`).
* Set `POSTGRES_PASSWORD` to a strong, random password (minimum 16 characters).
* Set `POSTGRES_DB` (e.g. `cafe_menu`).
* Set `JWT_SECRET` to the generated hex string.
* Set `PUBLIC_URL` to your Cloudflare domain (e.g. `https://menu.yourcafe.com`).
* Set `CLOUDFLARE_TUNNEL_TOKEN` to your token from Cloudflare Zero Trust.
* Restrict file permissions: `chmod 600 .env`.

Launch with the tunnel profile:
```bash
docker compose --profile tunnel up --build -d
```

Verify service status:
```bash
docker compose ps
```

---

## 5. First-Run Onboarding & Configuration

The application starts with a clean database containing **zero copied production records**.

1. **Access the Onboarding Wizard**:
   * Open a web browser and navigate to your public domain: `https://menu.yourcafe.com/admin/login` (or locally at `http://localhost/admin/login`).
   * The system detects that no administrator accounts exist and enters **First-Run Setup Mode**.
2. **Create Master Administrator**:
   * Enter your Café Name (e.g., *The Golden Brew*).
   * Enter your master admin email and a strong password (minimum 6 characters).
   * Click **Create Master Admin & Initialize**.
3. **Configure Café Profile**:
   * Go to **Settings** (`/admin/settings`).
   * Set café opening hours, address, phone/WhatsApp number for customer inquiries, and upload your high-resolution logo and hero banner.
4. **Populate Menu Sections & Items**:
   * Go to **Menu Items** (`/admin/items`).
   * Create your categories (e.g. *Hot Beverages*, *Cold Brews*, *Bakery & Desserts*).
   * Add menu items with descriptions, prices, dietary tags (Veg, Spicy, Bestseller), and upload photos.
5. **Generate & Print Table QR Codes**:
   * Go to **QR Generator** (`/admin/qr`).
   * Confirm that the **Configured Public HTTPS Hostname** is set to `https://menu.yourcafe.com`.
   * Add table numbers (e.g., Table 1 to 20).
   * Download the high-resolution PNG QR codes. Each QR code is rendered client-side in the browser and embeds the stable public URL with the query parameter `?table=<number>`.

---

## 6. Testing Public Mobile Data Access

Before printing QR stickers:

1. **Disconnect Wi-Fi on a Smartphone**: Turn off Wi-Fi on your phone and enable 4G/5G mobile data.
2. **Scan the Generated QR Code**:
   * Point the camera at a generated QR code.
   * Verify the phone browser opens `https://menu.yourcafe.com/?table=1`.
3. **Verify Full Customer Journey**:
   * Browse categories and add an item to the cart.
   * Place a test order.
   * Verify the live order status updates to "Received".
4. **Verify Kitchen Screen**:
   * On the café counter tablet / computer, open the kitchen dashboard (`/admin/orders`).
   * Verify the test order appeared instantly in realtime without refreshing.
   * Mark the order as "Preparing" and confirm the customer's phone updates within 1 second.

---

## 7. Physical Server Resilience & Operational Protections

> [!WARNING]
> **Single-Server Downtime Reality**:
> A self-hosted single-server deployment **does not have zero downtime**. The physical server hardware, local power grid, router, optical modem, ISP connection, and Cloudflare edge network are individual single points of failure. The café server and its internet connection remain single points of failure. Follow the resilience guidelines below to maximize uptime.

### 7.1 Power Protection (UPS)
* Connect the **server**, **internet router/ONT**, and **network switch** to an Uninterruptible Power Supply (UPS) with at least 1000VA capacity.
* This protects against brownouts, voltage spikes, and brief power flickers that would otherwise abruptly power down PostgreSQL and corrupt active transactions.

### 7.2 Secondary / Failover Internet (Optional)
* If your café relies heavily on customer QR orders, install a dual-WAN router with automated 4G/5G LTE cellular failover.
* If your primary fiber ISP drops, the router automatically routes traffic over the cellular backup without dropping the Cloudflare tunnel.

---

## 8. Backup & Disaster Recovery Strategy

All persistent data resides in two Docker volumes:
* `cafe_pgdata`: All PostgreSQL tables, menus, orders, admin accounts, and analytics.
* `cafe_media_data`: Uploaded menu item images and café banners.

> [!CAUTION]
> **Volume Safety Mandate**:
> **`docker compose down -v` or `docker compose down --volumes` MUST NEVER BE RUN.**
> The `-v` flag deletes Docker volumes and will permanently destroy all database records and images. Always use `docker compose stop` or `docker compose down` (without `-v`).

### 8.1 Automated Nightly Backup Script
Create an off-device backup script on the server at `/usr/local/bin/cafe-backup.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/mnt/usb_backup/cafe_backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="${BACKUP_DIR}/${TIMESTAMP}"

mkdir -p "${BACKUP_PATH}"

# 1. Dump PostgreSQL database to compressed binary archive
docker compose -f /home/user/local-cafe/docker-compose.yml exec -T db \
  pg_dump -U cafe_admin -d cafe_menu -F c -b > "${BACKUP_PATH}/database.dump"

# 2. Archive media uploads directory
tar -czf "${BACKUP_PATH}/media_uploads.tar.gz" -C /var/lib/docker/volumes/cafe_media_data/_data .

# 3. Keep only the last 30 daily backups
find "${BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +

echo "Backup completed successfully at ${BACKUP_PATH}"
```

Make it executable and add to crontab:
```bash
chmod +x /usr/local/bin/cafe-backup.sh
# Run nightly at 3:00 AM
(crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/cafe-backup.sh >> /var/log/cafe-backup.log 2>&1") | crontab -
```

### 8.2 Disaster Recovery & Restore Verification
To test or execute a complete database restore:

```bash
# 1. Stop backend to prevent active connections
docker compose stop backend

# 2. Drop existing database and restore from dump
docker compose exec -T db dropdb -U cafe_admin --if-exists cafe_menu
docker compose exec -T db createdb -U cafe_admin cafe_menu
cat /path/to/database.dump | docker compose exec -T db pg_restore -U cafe_admin -d cafe_menu -v

# 3. Restore media assets
tar -xzf /path/to/media_uploads.tar.gz -C /var/lib/docker/volumes/cafe_media_data/_data

# 4. Restart backend and frontend
docker compose up -d
```
