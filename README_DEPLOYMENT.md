# 🏪 Warung Rafilah POS - Deployment Guide

## 📍 Arsitektur Deployment

```
┌─────────────────────────────────────────────────────────────┐
│                   DEVELOPMENT ENVIRONMENT                     │
│                                                               │
│  💻 Laptop Windows                                           │
│  ├── VSCode / Editor                                         │
│  ├── Git Repository (local)                                  │
│  ├── Docker Desktop (optional - untuk testing)              │
│  └── SSH Client (untuk remote ke PC Kasir)                  │
│                                                               │
│             ⬇️  Push Code via Git/SSH/USB                    │
└─────────────────────────────────────────────────────────────┘

                              ⬇️

┌─────────────────────────────────────────────────────────────┐
│                  PRODUCTION ENVIRONMENT                       │
│                                                               │
│  🖥️  PC Kasir - Linux Mint                                  │
│  ├── Spec: 8GB RAM, 512GB SSD                               │
│  ├── Docker + Docker Compose                                │
│  ├── PostgreSQL 16 (via Docker)                             │
│  ├── Next.js App (via Docker)                               │
│  ├── n8n + WAHA + Cloudflare Tunnel                         │
│  └── USB Thermal Printer + Cash Drawer                      │
│                                                               │
│             ⬇️  Expose via Cloudflare Tunnel                 │
└─────────────────────────────────────────────────────────────┘

                              ⬇️

┌─────────────────────────────────────────────────────────────┐
│                    ACCESS POINTS                              │
│                                                               │
│  🌐 Internet (via Cloudflare)                               │
│  └── https://pos.yourdomain.com                             │
│      ├── Owner dapat akses dari rumah                       │
│      ├── DDoS protection                                     │
│      └── Zero Trust security                                 │
│                                                               │
│  🏪 Local Network (LAN)                                      │
│  └── http://192.168.1.100:3000                              │
│      └── Kasir akses langsung dari toko                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Quick Start Guide

### **Step 1: Setup Development Environment (Laptop Windows)**

```powershell
# Clone repository
git clone https://github.com/your-username/Warung-Rafilah.git
cd Warung-Rafilah

# Edit kode dengan VSCode atau editor favorit
code .
```

### **Step 2: Deploy ke PC Kasir**

**Opsi A - Via Git (Recommended):**
```bash
# Di PC Kasir Linux Mint
git clone https://github.com/your-username/Warung-Rafilah.git
cd Warung-Rafilah
chmod +x mulai-pos-fix.sh
./mulai-pos-fix.sh
```

**Opsi B - Via SSH dari Laptop:**
```powershell
# Di Laptop Windows
ssh kasir@192.168.1.100

# Di terminal PC Kasir
cd ~/Warung-Rafilah
git pull
./mulai-pos-fix.sh
```

**Opsi C - Via USB Drive:**
```powershell
# Copy folder ke USB, lalu extract di PC Kasir
cd ~/Warung-Rafilah
./mulai-pos-fix.sh
```

### **Step 3: Verifikasi**

Buka browser:
- **Local**: http://192.168.1.100:3000
- **Remote**: https://pos.yourdomain.com

Login default:
- **Username**: `admin`
- **PIN**: `123456`

---

## 📚 Documentation Files

| File | Deskripsi |
|------|-----------|
| [DEPLOYMENT_LOCAL_POS.md](./DEPLOYMENT_LOCAL_POS.md) | 📖 Full deployment guide dengan security hardening |
| [CARA_DEPLOY_KE_PC_KASIR.md](./CARA_DEPLOY_KE_PC_KASIR.md) | 🚀 Step-by-step deployment dari laptop ke PC Kasir |
| [PERBAIKAN_ERROR.md](./PERBAIKAN_ERROR.md) | 🔧 Troubleshooting error startup (USB device, credential) |
| [AGENTS.md](./app/AGENTS.md) | 🤖 Dokumentasi AI agents untuk AmarthaFin |

---

## 🛠️ Tech Stack

### Backend:
- **Framework**: Next.js 16 (App Router) + React 19
- **Database**: PostgreSQL 16 (Alpine)
- **Authentication**: JWT + bcrypt (PIN-based)
- **API**: REST API (Next.js Route Handlers)

### Frontend:
- **UI**: React 19 + Tailwind CSS 4
- **Icons**: Lucide React
- **State**: React hooks (no Redux/Zustand)

### Infrastructure:
- **Container**: Docker + Docker Compose
- **Networking**: Cloudflare Tunnel (Zero Trust)
- **Automation**: n8n (workflow engine)
- **WhatsApp**: WAHA (WhatsApp HTTP API)

### Hardware Integration:
- **Printer**: ESC/POS via USB (`/dev/usb/lp0`)
- **Cash Drawer**: RJ12 via thermal printer

---

## 🚀 Services Overview

```yaml
# 5 Docker Services di PC Kasir:

1. pos_postgres       # PostgreSQL database
   └── Port: 127.0.0.1:5432 (localhost only)
   
2. pos_nextjs         # Next.js POS application
   └── Port: 3000 (exposed)
   
3. pos_n8n            # n8n workflow automation
   └── Port: 127.0.0.1:5678 (localhost only)
   
4. pos_waha           # WhatsApp HTTP API
   └── Port: 127.0.0.1:3001 (localhost only)
   
5. pos_cloudflared    # Cloudflare Tunnel
   └── No port (tunnel to Cloudflare network)
```

**Total Resource Usage:**
- RAM: ~3.5GB (optimized untuk 8GB PC)
- Storage: ~5GB (termasuk images + data)
- CPU: 2-4 cores (under load)

---

## 🔐 Security Features

### Network Security:
- ✅ All ports bound to `127.0.0.1` (kecuali port 3000)
- ✅ Cloudflare Tunnel untuk remote access (no port forwarding)
- ✅ Zero Trust network access
- ✅ DDoS protection via Cloudflare

### Database Security:
- ✅ SCRAM-SHA-256 password encryption
- ✅ Localhost-only binding
- ✅ Audit logging untuk semua actions
- ✅ Prepared statements (SQL injection protection)

### Application Security:
- ✅ JWT authentication dengan refresh token
- ✅ bcrypt password hashing
- ✅ Content Security Policy headers
- ✅ XSS protection
- ✅ CSRF protection

### Physical Security:
- ✅ PC di area terbatas (tidak public)
- ✅ BIOS password
- ✅ Auto screen lock (5 menit idle)
- ✅ CCTV monitoring kasir
- ✅ UPS backup power

---

## 📦 Environment Variables

File `.env` di PC Kasir harus berisi:

```ini
# Database
POSTGRES_USER=pos_admin
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=pos_production

# Security
JWT_SECRET=<generate-dengan-openssl-rand-hex-32>
QRIS_WEBHOOK_SECRET=<generate-dengan-openssl-rand-hex-32>

# Cloudflare Tunnel
CLOUDFLARE_TUNNEL_TOKEN=<dari-cloudflare-dashboard>

# Hardware (optional, jika ada printer)
CASH_DRAWER_DEVICE=/dev/usb/lp0

# n8n
N8N_USER=admin
N8N_PASSWORD=<strong-password>

# WAHA
WAHA_API_KEY=<generate-random>
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD=<strong-password>

# AI (optional)
GEMINI_API_KEY=<jika-pakai-gemini>
AI_BASE_URL=<jika-pakai-custom-ai>
AI_API_KEY=<jika-pakai-custom-ai>
AI_MODEL=<model-name>
```

**Generate secrets:**
```bash
openssl rand -hex 32  # untuk JWT_SECRET dan QRIS_WEBHOOK_SECRET
```

---

## 🔄 Update Workflow

### Scenario: Fix bug di laptop, deploy ke PC Kasir

**Di Laptop:**
```powershell
# 1. Edit kode
# 2. Test (optional)
# 3. Commit
git add .
git commit -m "Fix: startup error"
git push origin main
```

**Di PC Kasir:**
```bash
# 1. Pull update
cd ~/Warung-Rafilah
git pull origin main

# 2. Restart services
docker compose down
docker compose build --no-cache pos_nextjs
./mulai-pos-fix.sh

# 3. Monitor
docker compose logs -f pos_nextjs
```

---

## 🆘 Common Issues & Solutions

### Error: USB Device Not Found
```bash
# Solusi: USB device sudah di-disable di docker-compose.linux.yml
# Jika mau aktifkan lagi (setelah colok printer):
ls -l /dev/usb/lp*  # cek device ada
# Uncomment di docker-compose.linux.yml
```

### Error: Credential Decryption Failed
```bash
# Solusi: Bersihkan Docker credential cache
docker builder prune -f
docker compose build --no-cache
```

### Error: Port Already in Use
```bash
# Cek proses yang pakai port
sudo lsof -i :3000
# Kill proses
sudo kill -9 <PID>
```

### Error: Database Connection Refused
```bash
# Tunggu database healthy (30 detik)
docker compose logs postgres
# Restart jika perlu
docker compose restart postgres
```

Lihat [PERBAIKAN_ERROR.md](./PERBAIKAN_ERROR.md) untuk detail lengkap.

---

## 📊 Monitoring Commands

```bash
# Cek status semua containers
docker compose ps

# Monitor logs real-time
docker compose logs -f

# Cek resource usage
docker stats

# Cek database health
docker exec pos_postgres pg_isready -U pos_admin

# Cek app health
curl http://localhost:3000/api/health
```

---

## 💾 Backup & Recovery

### Manual Backup:
```bash
# Backup database
docker exec pos_postgres pg_dump -U pos_admin pos_production > backup_$(date +%Y%m%d).sql

# Compress backup
tar -czf backup_$(date +%Y%m%d).tar.gz backup_$(date +%Y%m%d).sql
```

### Recovery:
```bash
# Restore dari backup
docker exec -i pos_postgres psql -U pos_admin pos_production < backup.sql
```

### Automated Backup:
Setup di Windows Task Scheduler atau cron (Linux) untuk backup otomatis setiap hari jam 2 pagi.

---

## 🎓 Training untuk Kasir

### Basic Operations:
1. **Login**: Username + 6-digit PIN
2. **Scan Barcode**: Otomatis detect scanner
3. **Manual Input**: Ketik kode produk + Enter
4. **Checkout**: Pilih payment method (cash/QRIS/split)
5. **Logout**: Tombol logout di pojok kanan atas

### Troubleshooting Basic:
- **App tidak bisa diakses**: Restart PC Kasir
- **Printer tidak print**: Cek kabel USB + power printer
- **Laci kasir tidak buka**: Cek koneksi RJ12 printer-laci
- **Barcode scanner tidak detect**: Cek kabel USB scanner

### Emergency Contact:
- **IT Support**: [nomor-telepon]
- **Owner**: [nomor-telepon]

---

## 📞 Support

**Developer**: [Your Name]  
**Email**: [your-email]  
**Project Repository**: [GitHub URL]  

---

**Last Updated**: 2026-07-06  
**Version**: 1.0.0  
**Deployment Target**: PC Kasir Linux Mint (8GB RAM, 512GB SSD)
