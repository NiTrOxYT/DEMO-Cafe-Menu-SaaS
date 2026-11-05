# ==============================================================================
# One-Command Startup Script for Local Café QR Menu System (Windows PowerShell)
# Supported Public HTTPS Ingress: Cloudflare Tunnel
# ==============================================================================

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host " Starting Local Café QR Menu SaaS (Cloudflare Tunnel Deployment)" -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# 1. Check Docker Prerequisites
# ------------------------------------------------------------------------------
Write-Host "[1/5] Checking Docker installation and daemon..." -ForegroundColor Yellow

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Host ""
    Write-Host "[-] ERROR: 'docker' command was not found." -ForegroundColor Red
    Write-Host "    Docker must be installed separately on this machine before running this script."
    Write-Host "    Please install Docker Desktop for Windows with WSL2 enabled:"
    Write-Host "    https://www.docker.com/products/docker-desktop/"
    Write-Host "    See local-cafe/README.md for complete installation instructions."
    exit 1
}

& docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[-] ERROR: Docker daemon is not running." -ForegroundColor Red
    Write-Host "    Please launch Docker Desktop and wait until it indicates 'Engine running', then retry."
    exit 1
}

& docker compose version 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[-] ERROR: 'docker compose' is not available." -ForegroundColor Red
    Write-Host "    Ensure the Docker Compose v2 plugin is enabled in Docker Desktop settings."
    exit 1
}

Write-Host "[+] Docker daemon and 'docker compose' are available." -ForegroundColor Green

# ------------------------------------------------------------------------------
# 2. Environment Configuration (.env) Setup
# ------------------------------------------------------------------------------
Write-Host "[2/5] Checking environment configuration (.env)..." -ForegroundColor Yellow

if (-not (Test-Path ".env")) {
    if (-not (Test-Path ".env.example")) {
        Write-Host "[-] ERROR: Neither .env nor .env.example was found in $ScriptDir." -ForegroundColor Red
        exit 1
    }

    Write-Host "    .env file does not exist. Creating .env from .env.example..."

    # Generate cryptographically secure random values without printing them
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    
    $passBytes = New-Object byte[] 24
    $rng.GetBytes($passBytes)
    $genPass = [System.Convert]::ToBase64String($passBytes) -replace '[^a-zA-Z0-9]', ''
    if ($genPass.Length -gt 24) { $genPass = $genPass.Substring(0, 24) }

    $jwtBytes = New-Object byte[] 32
    $rng.GetBytes($jwtBytes)
    $genJwt = ($jwtBytes | ForEach-Object { $_.ToString("x2") }) -join ""

    $template = Get-Content ".env.example"
    $newLines = @()
    foreach ($line in $template) {
        if ($line -match "^POSTGRES_PASSWORD=") {
            $newLines += "POSTGRES_PASSWORD=$genPass"
        } elseif ($line -match "^JWT_SECRET=") {
            $newLines += "JWT_SECRET=$genJwt"
        } else {
            $newLines += $line
        }
    }
    Set-Content -Path ".env" -Value $newLines -Encoding UTF8

    Write-Host "[+] Created .env with auto-generated POSTGRES_PASSWORD and JWT_SECRET." -ForegroundColor Green
} else {
    Write-Host "[+] Existing .env file found (preserved without overwriting)." -ForegroundColor Green
}

# ------------------------------------------------------------------------------
# 3. Cloudflare Tunnel Token & Placeholder Validation
# ------------------------------------------------------------------------------
Write-Host "[3/5] Validating secrets and Cloudflare Tunnel token..." -ForegroundColor Yellow

function Get-EnvValue([string]$key) {
    if (-not (Test-Path ".env")) { return "" }
    $line = Get-Content ".env" | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
    if ($line) {
        return ($line -replace "^$key=", "").Trim().Trim('"').Trim("'")
    }
    return ""
}

$currentToken = Get-EnvValue "CLOUDFLARE_TUNNEL_TOKEN"

if ([string]::IsNullOrWhiteSpace($currentToken) -or $currentToken -like "*replace_with*" -or $currentToken -like "*placeholder*") {
    Write-Host ""
    Write-Host "==========================================================================" -ForegroundColor Cyan
    Write-Host " Cloudflare Tunnel Setup Required" -ForegroundColor Cyan
    Write-Host "==========================================================================" -ForegroundColor Cyan
    Write-Host "To enable public HTTPS access for customer QR scanning over mobile data,"
    Write-Host "you must configure a tunnel in Cloudflare Zero Trust first:"
    Write-Host ""
    Write-Host " 1. Log in to Cloudflare Zero Trust (https://one.dash.cloudflare.com/)"
    Write-Host " 2. Navigate to Networks -> Tunnels -> Create a Tunnel"
    Write-Host " 3. Name your tunnel (e.g. 'cafe-server') and select 'cloudflared'"
    Write-Host " 4. Under 'Public Hostname', add your domain (e.g. menu.yourcafe.com) and"
    Write-Host "    route it to Service: HTTP -> frontend:80"
    Write-Host " 5. Copy the tunnel token provided in the installation step."
    Write-Host "==========================================================================" -ForegroundColor Cyan
    Write-Host ""

    $secToken = Read-Host -Prompt "Enter your Cloudflare Tunnel Token" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secToken)
    $inputToken = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

    if ([string]::IsNullOrWhiteSpace($inputToken) -or $inputToken -like "*replace_with*" -or $inputToken -like "*placeholder*") {
        Write-Host "[-] ERROR: A valid Cloudflare Tunnel token is required to start public access." -ForegroundColor Red
        Write-Host "    Please create a tunnel in Cloudflare Zero Trust and re-run this script."
        exit 1
    }

    $envLines = Get-Content ".env"
    $updatedLines = @()
    foreach ($line in $envLines) {
        if ($line -match "^CLOUDFLARE_TUNNEL_TOKEN=") {
            $updatedLines += "CLOUDFLARE_TUNNEL_TOKEN=$inputToken"
        } else {
            $updatedLines += $line
        }
    }
    Set-Content -Path ".env" -Value $updatedLines -Encoding UTF8
    Write-Host "[+] Cloudflare Tunnel token saved to .env." -ForegroundColor Green
}

# Verify no placeholders remain
function Test-Placeholder([string]$val) {
    if ([string]::IsNullOrWhiteSpace($val)) { return $true }
    $lower = $val.ToLower()
    return ($lower -like "*replace_with*" -or $lower -like "*placeholder*" -or `
            $lower -like "*cafe_secure_pass*" -or $lower -like "*admin123*" -or `
            $lower -like "*change_in_production*")
}

$checkPgPass = Get-EnvValue "POSTGRES_PASSWORD"
$checkJwt = Get-EnvValue "JWT_SECRET"
$checkToken = Get-EnvValue "CLOUDFLARE_TUNNEL_TOKEN"

if (Test-Placeholder $checkPgPass) {
    Write-Host "[-] ERROR: POSTGRES_PASSWORD in .env still contains a placeholder value." -ForegroundColor Red
    Write-Host "    Refusing to start. Please provide a strong password in .env."
    exit 1
}

if ((Test-Placeholder $checkJwt) -or ($checkJwt.Length -lt 16)) {
    Write-Host "[-] ERROR: JWT_SECRET in .env is missing, contains a placeholder, or is under 16 chars." -ForegroundColor Red
    Write-Host "    Refusing to start. Generate one with: openssl rand -hex 32"
    exit 1
}

if (Test-Placeholder $checkToken) {
    Write-Host "[-] ERROR: CLOUDFLARE_TUNNEL_TOKEN in .env contains a placeholder." -ForegroundColor Red
    Write-Host "    Refusing to start. Supply a valid token from Cloudflare Zero Trust."
    exit 1
}

Write-Host "[+] Security check passed: No placeholder secrets detected." -ForegroundColor Green

# ------------------------------------------------------------------------------
# 4. Build and Start Docker Containers
# ------------------------------------------------------------------------------
Write-Host "[4/5] Building and launching containers with Cloudflare Tunnel profile..." -ForegroundColor Yellow

& docker compose --profile tunnel up --build -d
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[-] ERROR: 'docker compose' failed to start." -ForegroundColor Red
    Write-Host "    Recent container logs:"
    & docker compose logs --tail=40
    exit 1
}

# ------------------------------------------------------------------------------
# 5. Wait for Services to Become Healthy
# ------------------------------------------------------------------------------
Write-Host "[5/5] Waiting for services to become healthy (timeout: 90s)..." -ForegroundColor Yellow

$maxAttempts = 30
$attempt = 0
$allHealthy = $false

function Get-ContainerHealth([string]$name) {
    $out = & docker inspect --format="{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" $name 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($out)) { return "missing" }
    return $out.Trim()
}

function Get-ContainerStatus([string]$name) {
    $out = & docker inspect --format="{{.State.Status}}" $name 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($out)) { return "missing" }
    return $out.Trim()
}

while ($attempt -lt $maxAttempts) {
    $attempt++
    Start-Sleep -Seconds 3

    $dbHealth = Get-ContainerHealth "local_cafe_db"
    $beHealth = Get-ContainerHealth "local_cafe_backend"
    $feHealth = Get-ContainerHealth "local_cafe_frontend"
    $tunnelStatus = Get-ContainerStatus "local_cafe_tunnel"

    if ($dbHealth -eq "healthy" -and $beHealth -eq "healthy" -and $feHealth -eq "healthy" -and $tunnelStatus -eq "running") {
        $allHealthy = $true
        break
    }

    Write-Host "    Waiting... (attempt $attempt/$maxAttempts: db=$dbHealth, backend=$beHealth, frontend=$feHealth, tunnel=$tunnelStatus)"
}

if (-not $allHealthy) {
    Write-Host ""
    Write-Host "[-] ERROR: Services did not all reach 'healthy' state within 90 seconds." -ForegroundColor Red
    Write-Host ""
    Write-Host "Current container states:"
    & docker compose ps
    Write-Host ""
    Write-Host "Recent container logs:"
    & docker compose logs --tail=30
    exit 1
}

$publicUrl = Get-EnvValue "PUBLIC_URL"
if ([string]::IsNullOrWhiteSpace($publicUrl)) { $publicUrl = "https://menu.yourcafe.com" }

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "  Local Café QR Menu SaaS is ONLINE and HEALTHY" -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host " Service Status:"
Write-Host "   * Database (PostgreSQL 16) : Healthy (Private internal network only)"
Write-Host "   * Backend API & Realtime   : Healthy (Private internal network only)"
Write-Host "   * Frontend Web Server      : Healthy (Port 80)"
Write-Host "   * Cloudflare Tunnel        : Container running (Edge connectivity unverified - check Cloudflare Zero Trust dashboard or run 'docker compose logs tunnel')"
Write-Host ""
Write-Host " Next Steps for Café Setup:"
Write-Host "   1. Ensure your public domain in Cloudflare Zero Trust routes to:"
Write-Host "        Service: HTTP -> frontend:80"
Write-Host "   2. Open your public domain in your browser:"
Write-Host "        $publicUrl/admin/login"
Write-Host "      (Or locally at: http://localhost:8080/admin/login)"
Write-Host "   3. Complete the First-Run Setup Wizard to create the Master Admin account."
Write-Host "   4. Configure restaurant details, create menu categories, and add items."
Write-Host "   5. Navigate to /admin/qr to generate and print table QR codes."
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host ""

