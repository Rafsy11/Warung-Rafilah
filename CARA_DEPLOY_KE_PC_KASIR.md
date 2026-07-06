# 📦 Cara Deploy dari Laptop Development ke PC Kasir

## 🎯 Overview

```
Laptop Windows (Development)  ───push───>  PC Linux Mint (Production)
   └─ Edit kode                              └─ Jalankan POS
   └─ Testing                                └─ 8GB RAM, 512GB SSD
   └─ Git commit                             └─ USB Printer + Cash Drawer
```

---

## 📋 Prerequisites

### Di Laptop Windows (Development):
- ✅ Git sudah terinstall
- ✅ Kode sudah di-edit dan di-test
- ✅ Akses ke PC Kasir via:
  - SSH (remote), ATAU
  - USB Drive (offline), ATAU  
  - Network Share (LAN), ATAU
  - Git Remote (GitHub/GitLab)

### Di PC Kasir Linux Mint:
- ✅ Docker sudah terinstall
- ✅ Git sudah terinstall
- ✅ Akses ke internet (untuk pull Docker images)

---

## 🚀 Metode Deployment (Pilih salah satu)

### **Metode 1: Git Remote (RECOMMENDED)**

#### **Setup Awal** (sekali saja):

**Di Laptop Windows:**
```powershell
# Push ke GitHub/GitLab
cd "C:\Users\lenov\Documents\My Web\Warung-Rafilah"
git add .
git commit -m "Update POS code"
git push origin main
```

**Di PC Kasir Linux Mint:**
```bash
# Clone pertama kali (jika belum ada)
cd ~
git clone https://github.com/your-username/Warung-Rafilah.git
cd Warung-Rafilah

# Atau jika sudah ada, pull update
cd ~/Warung-Rafilah
git pull origin main
```

#### **Deployment Rutin**:

**Di Laptop Windows** (setelah edit kode):
```powershell
git add .
git commit -m "Fix: perbaikan error startup"
git push origin main
```

**Di PC Kasir Linux Mint** (via SSH atau langsung):
```bash
# 1. Stop POS
docker compose down

# 2. Pull update kode terbaru
cd ~/Warung-Rafilah
git pull origin main

# 3. Rebuild jika ada perubahan kode
docker compose build --no-cache pos_nextjs

# 4. Start lagi
./mulai-pos-fix.sh
```

---

### **Metode 2: SSH & rsync (Local Network)**

Jika PC Kasir dan Laptop di jaringan yang sama:

**Di PC Kasir** (setup SSH server):
```bash
# Install openssh-server jika belum ada
sudo apt update
sudo apt install openssh-server

# Start SSH service
sudo systemctl start ssh
sudo systemctl enable ssh

# Cek IP address PC Kasir
ip addr show | grep inet
# Contoh output: 192.168.1.100
```

**Di Laptop Windows** (PowerShell):
```powershell
# Sync file ke PC Kasir via SCP
$PC_KASIR_IP = "192.168.1.100"  # Ganti dengan IP PC Kasir
$PC_KASIR_USER = "kasir"         # Username di PC Kasir

# Copy seluruh folder
scp -r "C:\Users\lenov\Documents\My Web\Warung-Rafilah" `
  ${PC_KASIR_USER}@${PC_KASIR_IP}:~/Warung-Rafilah-new

# Atau via WSL (jika sudah install WSL):
wsl rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  "/mnt/c/Users/lenov/Documents/My Web/Warung-Rafilah/" \
  ${PC_KASIR_USER}@${PC_KASIR_IP}:~/Warung-Rafilah/
```

**Di PC Kasir** (setelah file ter-copy):
```bash
cd ~/Warung-Rafilah
./mulai-pos-fix.sh
```

---

### **Metode 3: USB Drive (Offline)**

Jika tidak ada koneksi network antara laptop dan PC Kasir:

**Di Laptop Windows:**
```powershell
# 1. Compress folder
cd "C:\Users\lenov\Documents\My Web"
Compress-Archive -Path "Warung-Rafilah" -DestinationPath "D:\Warung-Rafilah.zip"

# 2. Copy ke USB Drive
Copy-Item "D:\Warung-Rafilah.zip" "E:\"  # E: adalah USB drive
```

**Di PC Kasir Linux Mint:**
```bash
# 1. Mount USB (biasanya auto-mount di /media)
# 2. Extract zip
cd ~
unzip /media/kasir/USB-DRIVE/Warung-Rafilah.zip

# 3. Jalankan
cd ~/Warung-Rafilah
./mulai-pos-fix.sh
```

---

## 🔧 Workflow Deployment Lengkap

### **Skenario: Kamu sudah perbaiki error di laptop, mau deploy ke PC Kasir**

**Step 1: Di Laptop Windows (Development)**
```powershell
# 1. Pastikan kode sudah di-save
# 2. Test di local (optional)
cd "C:\Users\lenov\Documents\My Web\Warung-Rafilah"

# 3. Commit changes
git add .
git commit -m "Fix: Docker credential error dan USB device issue"

# 4. Push ke remote
git push origin main
```

**Step 2: Remote ke PC Kasir (via SSH)**

**Dari Laptop Windows:**
```powershell
# SSH ke PC Kasir
ssh kasir@192.168.1.100

# Atau via PuTTY jika lebih prefer GUI
```

**Di terminal PC Kasir:**
```bash
# 1. Masuk ke folder project
cd ~/Warung-Rafilah

# 2. Backup .env (jangan sampai ke-overwrite)
cp .env .env.backup

# 3. Pull kode terbaru
git pull origin main

# 4. Restore .env jika ke-overwrite
if [ ! -f .env ]; then
    cp .env.backup .env
fi

# 5. Stop container lama
docker compose down

# 6. Bersihkan cache Docker
docker builder prune -f

# 7. Build ulang image
docker compose -f docker-compose.yml build --no-cache pos_nextjs

# 8. Start dengan script fix
chmod +x mulai-pos-fix.sh
./mulai-pos-fix.sh

# 9. Monitor logs
docker compose logs -f pos_nextjs
```

**Step 3: Verifikasi di Browser**

Buka dari komputer manapun di jaringan:
- Local: `http://192.168.1.100:3000` (IP PC Kasir)
- Via Cloudflare Tunnel: `https://pos.yourdomain.com`

---

## 📝 Checklist Deployment

### Pre-Deployment:
- [ ] Kode sudah di-commit dan di-push
- [ ] File `.env` di PC Kasir sudah di-backup
- [ ] Tanya kasir apakah ada transaksi aktif (jangan deploy saat lagi rame!)
- [ ] Pastikan PC Kasir terkoneksi internet

### During Deployment:
- [ ] Stop container lama: `docker compose down`
- [ ] Pull kode terbaru: `git pull`
- [ ] Build image baru: `docker compose build --no-cache`
- [ ] Start services: `./mulai-pos-fix.sh`
- [ ] Monitor logs: `docker compose logs -f`

### Post-Deployment:
- [ ] Test login ke POS
- [ ] Test barcode scanner
- [ ] Test transaksi sample (beli 1 produk)
- [ ] Test cash drawer open (jika ada printer)
- [ ] Cek logs untuk error: `docker compose logs --tail=100`
- [ ] Inform kasir bahwa system sudah update

---

## 🚨 Rollback Plan (Jika Ada Masalah)

```bash
# Jika deployment gagal, rollback ke versi sebelumnya

# 1. Cek git log untuk commit sebelumnya
git log --oneline -5

# 2. Rollback ke commit sebelumnya
git checkout <commit-hash-sebelumnya>
# Contoh: git checkout a1b2c3d

# 3. Rebuild dan restart
docker compose down
docker compose build --no-cache pos_nextjs
./mulai-pos-fix.sh

# 4. Jika sudah OK, buat branch baru
git checkout -b rollback-temp
git checkout main
```

---

## 🔒 Security Notes

### **PENTING: File yang TIDAK boleh di-commit ke Git**

Pastikan file-file ini ada di `.gitignore`:
```
.env
.env.local
*.log
node_modules/
.next/
postgres_data/
backups/
*.dump
*.7z
```

### **Credentials yang Harus Di-setup Manual di PC Kasir**

File `.env` di PC Kasir harus punya:
```ini
# Database
POSTGRES_PASSWORD=<password-kuat-unik-untuk-pc-kasir>

# JWT
JWT_SECRET=<generate-baru-dengan-openssl-rand-hex-32>

# Cloudflare
CLOUDFLARE_TUNNEL_TOKEN=<token-dari-cloudflare-dashboard>

# Hardware (jika ada printer)
CASH_DRAWER_DEVICE=/dev/usb/lp0
```

**Generate secrets baru:**
```bash
# Di PC Kasir Linux Mint
openssl rand -hex 32  # JWT_SECRET
openssl rand -hex 32  # QRIS_WEBHOOK_SECRET
```

---

## 📞 Troubleshooting Remote Deployment

### **Error: Cannot SSH to PC Kasir**
```bash
# Di PC Kasir, cek SSH service
sudo systemctl status ssh

# Jika tidak running
sudo systemctl start ssh

# Cek firewall
sudo ufw status
sudo ufw allow 22/tcp  # Allow SSH
```

### **Error: Git pull conflict**
```bash
# Di PC Kasir
git stash  # Simpan perubahan local sementara
git pull origin main
git stash pop  # Restore perubahan local

# Atau reset total (hati-hati!)
git fetch origin
git reset --hard origin/main
```

### **Error: Docker build gagal**
```bash
# Bersihkan total Docker cache
docker system prune -a --volumes

# Rebuild dari nol
docker compose build --no-cache --pull
```

### **Error: Port already in use**
```bash
# Cek proses yang pakai port 3000
sudo lsof -i :3000

# Kill proses (ganti PID dengan hasil lsof)
sudo kill -9 <PID>

# Atau restart PC Kasir
sudo reboot
```

---

## 🎯 Best Practices

1. **Deploy saat toko tutup** atau tidak ada transaksi
2. **Backup database dulu** sebelum deploy major update:
   ```bash
   docker exec pos_postgres pg_dump -U pos_admin pos_production > backup_$(date +%Y%m%d).sql
   ```
3. **Test di laptop dulu** sebelum deploy ke production
4. **Monitor logs** minimal 5 menit setelah deployment
5. **Dokumentasi setiap perubahan** di commit message
6. **Inform kasir** setelah deployment selesai

---

## 📄 Quick Reference Commands

### **Di Laptop Windows** (PowerShell):
```powershell
# Commit dan push
git add . ; git commit -m "message" ; git push

# SSH ke PC Kasir
ssh kasir@192.168.1.100

# Copy file via SCP
scp file.txt kasir@192.168.1.100:~/Warung-Rafilah/
```

### **Di PC Kasir Linux Mint**:
```bash
# Update dan restart POS (satu baris)
cd ~/Warung-Rafilah && git pull && docker compose down && docker compose build --no-cache pos_nextjs && ./mulai-pos-fix.sh

# Monitor logs
docker compose logs -f

# Cek status containers
docker compose ps

# Restart spesifik service
docker compose restart pos_nextjs

# Backup database
docker exec pos_postgres pg_dump -U pos_admin pos_production > backup.sql
```

---

## 📖 Related Documentation

- [DEPLOYMENT_LOCAL_POS.md](./DEPLOYMENT_LOCAL_POS.md) - Full deployment guide
- [PERBAIKAN_ERROR.md](./PERBAIKAN_ERROR.md) - Troubleshooting startup errors
- [README.md](./README.md) - Project overview

---

**Last Updated**: 2026-07-06  
**Deployment Target**: PC Kasir Linux Mint (8GB RAM, 512GB SSD)
