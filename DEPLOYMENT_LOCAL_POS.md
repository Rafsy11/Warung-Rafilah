# Deployment Guide - Local POS dengan Cloudflare Tunnel

## 🖥️ Spesifikasi PC POS Kasir
- **RAM**: 8GB
- **Storage**: 512GB SSD
- **Network**: Local + Cloudflare Tunnel
- **OS**: Windows (recommended: Windows 10/11 Pro)

## 🔐 Security Considerations untuk Local Deployment

### 1. **Keamanan Fisik (Physical Security)**
Karena PC berada di lokasi fisik toko, ini adalah prioritas UTAMA:

#### ✅ Checklist Keamanan Fisik:
- [ ] PC ditempatkan di area terbatas (tidak publik)
- [ ] BIOS password enabled
- [ ] Windows login password (strong password)
- [ ] Disable USB boot di BIOS
- [ ] Automatic screen lock (5 menit idle)
- [ ] CCTV monitoring area kasir
- [ ] Backup power (UPS) untuk mencegah data loss

### 2. **Network Security dengan Cloudflare Tunnel**

#### ✅ Keuntungan Cloudflare Tunnel:
- ✅ Tidak perlu port forwarding (lebih aman)
- ✅ DDoS protection otomatis
- ✅ Zero Trust network access
- ✅ SSL/TLS encryption built-in
- ✅ Hide IP address server

#### ⚙️ Konfigurasi Cloudflare Tunnel:

**Recommended Settings:**
```yaml
# cloudflared config.yml
tunnel: <your-tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  # POS Web App
  - hostname: pos.yourdomain.com
    service: http://localhost:3000
    originRequest:
      noTLSVerify: true
      connectTimeout: 30s
      
  # Block direct IP access
  - service: http_status:404
```

**Cloudflare Access Rules** (Zero Trust):
```
1. Geographic restrictions: Hanya Indonesia
2. IP Allowlist (optional): Restrict ke IP rumah/kantor owner
3. Rate limiting: 100 req/min per IP
4. WAF Rules: Block common attacks
```

### 3. **Database Security (PostgreSQL Local)**

#### ✅ PostgreSQL Hardening:


```ini
# postgresql.conf adjustments untuk 8GB RAM
# C:\Program Files\PostgreSQL\16\data\postgresql.conf

# Memory settings untuk 8GB RAM
shared_buffers = 2GB                # 25% dari RAM
effective_cache_size = 6GB          # 75% dari RAM
maintenance_work_mem = 512MB
work_mem = 32MB

# Connection limits (POS tidak butuh banyak)
max_connections = 50

# Security settings
ssl = on
password_encryption = scram-sha-256
ssl_ciphers = 'HIGH:MEDIUM:+3DES:!aNULL'

# Listen only on localhost (PENTING!)
listen_addresses = '127.0.0.1'
port = 5432

# Logging untuk audit
log_connections = on
log_disconnections = on
log_duration = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_statement = 'mod'  # Log semua INSERT/UPDATE/DELETE
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
```

```ini
# pg_hba.conf - Access Control
# C:\Program Files\PostgreSQL\16\data\pg_hba.conf

# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Local connections only (AMAN untuk local deployment)
local   all             postgres                                scram-sha-256
local   all             pos_admin                               scram-sha-256

# IPv4 localhost only
host    all             all             127.0.0.1/32            scram-sha-256
host    pos_production  pos_admin       127.0.0.1/32            scram-sha-256

# IPv6 localhost
host    all             all             ::1/128                 scram-sha-256

# JANGAN izinkan akses dari network lain!
# NO remote connections
```

### 4. **Backup Strategy untuk PC Lokal**

#### 🔄 Automated Backup Script:

**Windows Batch Script** (`backup-pos.bat`):
```batch
@echo off
setlocal

:: Configuration
set BACKUP_DIR=D:\POS_Backups
set DB_NAME=pos_production
set DB_USER=pos_admin
set PGPASSWORD=warungrafilah-pos-password-123
set DATE_STAMP=%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set DATE_STAMP=%DATE_STAMP: =0%

:: Create backup directory if not exists
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if not exist "%BACKUP_DIR%\daily" mkdir "%BACKUP_DIR%\daily"
if not exist "%BACKUP_DIR%\weekly" mkdir "%BACKUP_DIR%\weekly"

:: Backup database
echo [%date% %time%] Starting database backup...
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" ^
  -U %DB_USER% ^
  -h localhost ^
  -F c ^
  -b ^
  -v ^
  -f "%BACKUP_DIR%\daily\pos_backup_%DATE_STAMP%.dump" ^
  %DB_NAME%

if %ERRORLEVEL% EQU 0 (
    echo [%date% %time%] Backup completed successfully
) else (
    echo [%date% %time%] ERROR: Backup failed!
    exit /b 1
)

:: Compress backup
echo [%date% %time%] Compressing backup...
"C:\Program Files\7-Zip\7z.exe" a ^
  "%BACKUP_DIR%\daily\pos_backup_%DATE_STAMP%.7z" ^
  "%BACKUP_DIR%\daily\pos_backup_%DATE_STAMP%.dump" ^
  -mx=9 -mmt=2

del "%BACKUP_DIR%\daily\pos_backup_%DATE_STAMP%.dump"

:: Delete backups older than 7 days
forfiles /p "%BACKUP_DIR%\daily" /s /m *.7z /d -7 /c "cmd /c del @path" 2>nul

:: Weekly backup (keep for 90 days)
set DAY_OF_WEEK=%date:~0,3%
if "%DAY_OF_WEEK%"=="Sun" (
    copy "%BACKUP_DIR%\daily\pos_backup_%DATE_STAMP%.7z" "%BACKUP_DIR%\weekly\"
    forfiles /p "%BACKUP_DIR%\weekly" /s /m *.7z /d -90 /c "cmd /c del @path" 2>nul
)

echo [%date% %time%] Backup process completed
endlocal
```

**Setup Windows Task Scheduler:**
```powershell
# PowerShell command untuk setup scheduled backup
$action = New-ScheduledTaskAction -Execute "C:\POS\backup-pos.bat"
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Register-ScheduledTask -TaskName "POS_Daily_Backup" -Action $action -Trigger $trigger -Principal $principal
```

### 5. **Monitoring & Alerting untuk Local Setup**

#### 📊 Simple Health Check Script:

**PowerShell** (`health-check.ps1`):
```powershell
# POS Health Check Script
$logFile = "C:\POS\logs\health-check.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

function Write-Log {
    param($message)
    "$timestamp - $message" | Out-File -FilePath $logFile -Append
    Write-Host $message
}

# Check 1: PostgreSQL running
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgService.Status -eq "Running") {
    Write-Log "✓ PostgreSQL: Running"
} else {
    Write-Log "✗ PostgreSQL: NOT Running (CRITICAL)"
    # Auto-restart
    Start-Service $pgService.Name
}

# Check 2: Node.js app running
$nodeProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcess) {
    Write-Log "✓ Node.js: Running (PID: $($nodeProcess.Id))"
} else {
    Write-Log "✗ Node.js: NOT Running (CRITICAL)"
}

# Check 3: Disk space (warn if < 20GB free)
$disk = Get-PSDrive -Name C
$freeSpaceGB = [math]::Round($disk.Free / 1GB, 2)
if ($freeSpaceGB -lt 20) {
    Write-Log "⚠ Disk Space: ${freeSpaceGB}GB (LOW)"
} else {
    Write-Log "✓ Disk Space: ${freeSpaceGB}GB"
}

# Check 4: Memory usage
$os = Get-CimInstance Win32_OperatingSystem
$usedMemoryGB = [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1MB, 2)
$totalMemoryGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
$memoryPercent = [math]::Round(($usedMemoryGB / $totalMemoryGB) * 100, 0)

if ($memoryPercent -gt 90) {
    Write-Log "⚠ Memory: ${usedMemoryGB}GB / ${totalMemoryGB}GB (${memoryPercent}%)"
} else {
    Write-Log "✓ Memory: ${usedMemoryGB}GB / ${totalMemoryGB}GB (${memoryPercent}%)"
}

# Check 5: Web app responsiveness
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Log "✓ Web App: Responding"
    }
} catch {
    Write-Log "✗ Web App: NOT Responding (CRITICAL)"
}

# Check 6: Cloudflare tunnel
$cloudflaredProcess = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
if ($cloudflaredProcess) {
    Write-Log "✓ Cloudflare Tunnel: Running"
} else {
    Write-Log "✗ Cloudflare Tunnel: NOT Running"
}

Write-Log "Health check completed"
```

### 6. **Windows Security Hardening**

#### ✅ Windows Security Checklist:

```powershell
# PowerShell script untuk hardening Windows
# Run as Administrator

# 1. Enable Windows Firewall
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True

# 2. Block semua inbound connections kecuali yang dibutuhkan
# (PostgreSQL dan Node.js hanya listen di localhost, jadi aman)

# 3. Disable unnecessary services
$servicesToDisable = @(
    "RemoteRegistry",
    "RemoteAccess",
    "W3SVC",  # IIS jika tidak dipakai
    "FTPSVC"
)
foreach ($service in $servicesToDisable) {
    Set-Service -Name $service -StartupType Disabled -ErrorAction SilentlyContinue
}

# 4. Enable Windows Defender
Set-MpPreference -DisableRealtimeMonitoring $false

# 5. Configure automatic updates
# Settings > Update & Security > Windows Update
# Set to "Install updates automatically"

# 6. Disable RDP if not needed
Set-ItemProperty -Path "HKLM:\System\CurrentControlSet\Control\Terminal Server" -Name "fDenyTSConnections" -Value 1

# 7. Enable BitLocker (optional tapi recommended)
# untuk encrypt disk jika PC dicuri

Write-Host "Windows security hardening completed"
```

### 7. **Docker Compose untuk Local Deployment**

**Optimized untuk 8GB RAM:**

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: pos_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --auth-host=scram-sha-256"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    ports:
      - "127.0.0.1:5432:5432"  # Hanya bind ke localhost!
    shm_size: 512mb
    command: 
      - "postgres"
      - "-c"
      - "shared_buffers=512MB"
      - "-c"
      - "effective_cache_size=2GB"
      - "-c"
      - "max_connections=50"
      - "-c"
      - "log_statement=mod"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: ./app
      dockerfile: Dockerfile
    container_name: pos_app
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      PGHOST: postgres
      PGPORT: 5432
      JWT_SECRET: ${JWT_SECRET}
      QRIS_WEBHOOK_SECRET: ${QRIS_WEBHOOK_SECRET}
      SESSION_COOKIE_NAME: pos_session
    ports:
      - "127.0.0.1:3000:3000"  # Hanya bind ke localhost!
    mem_limit: 1g
    mem_reservation: 512m
    cpus: 2
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: pos_cloudflared
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      - app
    mem_limit: 256m

volumes:
  postgres_data:
    driver: local

networks:
  default:
    name: pos_network
    driver: bridge
```

### 8. **Startup Script**

**PowerShell** (`start-pos.ps1`):
```powershell
# POS Startup Script
param(
    [switch]$Dev,
    [switch]$Stop
)

$dockerComposeFile = "docker-compose.yml"

if ($Stop) {
    Write-Host "Stopping POS system..."
    docker-compose -f $dockerComposeFile down
    exit
}

Write-Host "Starting POS system..."
Write-Host "Environment: $(if ($Dev) { 'Development' } else { 'Production' })"

# Check if Docker is running
$dockerStatus = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker is not running! Please start Docker Desktop."
    exit 1
}

# Pull latest images (production only)
if (-not $Dev) {
    docker-compose -f $dockerComposeFile pull
}

# Start services
docker-compose -f $dockerComposeFile up -d

# Wait for services to be healthy
Write-Host "Waiting for services to be healthy..."
Start-Sleep -Seconds 10

# Check health
$appHealth = docker inspect --format='{{.State.Health.Status}}' pos_app
$dbHealth = docker inspect --format='{{.State.Health.Status}}' pos_postgres

Write-Host "App Health: $appHealth"
Write-Host "Database Health: $dbHealth"

if ($appHealth -eq "healthy" -and $dbHealth -eq "healthy") {
    Write-Host "✓ POS system started successfully!"
    Write-Host "Access via: http://localhost:3000"
} else {
    Write-Warning "Some services are not healthy. Check logs:"
    Write-Host "docker-compose logs -f"
}
```

### 9. **Security Monitoring Dashboard**

**Simple monitoring dengan PowerShell:**

```powershell
# monitor-security.ps1
$dbHost = "localhost"
$dbPort = "5432"
$dbName = "pos_production"
$dbUser = "pos_admin"
$env:PGPASSWORD = "warungrafilah-pos-password-123"

function Query-Database {
    param($query)
    $result = & "C:\Program Files\PostgreSQL\16\bin\psql.exe" `
        -h $dbHost -p $dbPort -U $dbUser -d $dbName `
        -t -A -c $query
    return $result
}

Write-Host "=== POS Security Dashboard ===" -ForegroundColor Cyan
Write-Host ""

# Failed login attempts (last 1 hour)
Write-Host "Failed Login Attempts (Last 1 Hour):" -ForegroundColor Yellow
$failedLogins = Query-Database @"
SELECT COUNT(*) FROM core.audit_logs 
WHERE action = 'login_failed' 
AND created_at > now() - interval '1 hour';
"@
Write-Host "  Count: $failedLogins"

# Top IPs with failed logins
Write-Host "`nTop IPs with Failed Logins (Last 24h):" -ForegroundColor Yellow
$topIPs = Query-Database @"
SELECT ip_address, COUNT(*) as attempts 
FROM core.audit_logs 
WHERE action = 'login_failed' 
AND created_at > now() - interval '24 hours'
GROUP BY ip_address 
ORDER BY attempts DESC 
LIMIT 5;
"@
Write-Host $topIPs

# Recent critical actions
Write-Host "`nRecent Critical Actions:" -ForegroundColor Yellow
$criticalActions = Query-Database @"
SELECT created_at, action, user_id, ip_address 
FROM core.audit_logs 
WHERE action IN ('product_delete', 'sale_cancel', 'float_adjust')
AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC 
LIMIT 10;
"@
Write-Host $criticalActions

Write-Host "`n=== End Dashboard ===" -ForegroundColor Cyan
```

### 10. **Quick Recovery Plan**

#### 🚨 Disaster Recovery Steps:

**Scenario: PC Crash / Data Loss**

```batch
REM recovery.bat

@echo off
echo === POS Recovery Procedure ===
echo.

REM 1. Stop all services
echo [1/5] Stopping services...
docker-compose down

REM 2. Restore database dari backup terakhir
echo [2/5] Restoring database...
set BACKUP_FILE=D:\POS_Backups\daily\latest.dump
"C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" ^
  -U pos_admin -h localhost -d pos_production ^
  -c -v "%BACKUP_FILE%"

REM 3. Verify database integrity
echo [3/5] Verifying database...
psql -U pos_admin -d pos_production -c "SELECT COUNT(*) FROM core.users;"

REM 4. Restart services
echo [4/5] Restarting services...
docker-compose up -d

REM 5. Health check
echo [5/5] Running health check...
timeout /t 10
curl http://localhost:3000/api/health

echo.
echo === Recovery Complete ===
pause
```

---

## 📋 Final Checklist untuk Local POS Deployment

### Pre-Deployment:
- [ ] Install Docker Desktop untuk Windows
- [ ] Install PostgreSQL 16
- [ ] Install Cloudflare Tunnel (cloudflared)
- [ ] Generate strong secrets
- [ ] Setup backup directory (D:\POS_Backups)
- [ ] Configure Windows Firewall
- [ ] Disable unnecessary Windows services
- [ ] Enable automatic Windows updates

### Deployment:
- [ ] Clone repository ke C:\POS
- [ ] Copy .env.example ke .env dan isi credentials
- [ ] Run database migrations
- [ ] Build Docker images
- [ ] Start services dengan docker-compose
- [ ] Configure Cloudflare Access rules
- [ ] Test access via tunnel URL

### Post-Deployment:
- [ ] Setup scheduled backup (Windows Task Scheduler)
- [ ] Setup health check monitoring
- [ ] Test backup & recovery procedure
- [ ] Configure automatic startup on boot
- [ ] Document admin passwords di safe place
- [ ] Train cashier untuk basic troubleshooting
- [ ] Setup remote monitoring (optional)

### Regular Maintenance (Weekly):
- [ ] Check audit_logs untuk suspicious activities
- [ ] Verify backups are running
- [ ] Check disk space
- [ ] Review failed login attempts
- [ ] Update Docker images (monthly)
- [ ] Test recovery procedure (monthly)

---

## 🆘 Troubleshooting

### Service Won't Start
```powershell
# Check logs
docker-compose logs -f

# Restart specific service
docker-compose restart app

# Full restart
docker-compose down && docker-compose up -d
```

### Database Connection Error
```powershell
# Check PostgreSQL service
Get-Service postgresql*

# Test connection
psql -U pos_admin -h localhost -d pos_production

# Check Docker network
docker network inspect pos_network
```

### High Memory Usage
```powershell
# Check container stats
docker stats

# Restart if needed
docker-compose restart app
```

---

**Last Updated**: 2026-06-25  
**For**: Local POS Deployment @ PC Kasir (8GB RAM, 512GB SSD)
