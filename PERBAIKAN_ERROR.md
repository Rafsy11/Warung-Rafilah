# 🔧 Panduan Perbaikan Error Startup POS

## 📍 Konteks Deployment
- **Laptop Development** (Windows): Untuk coding/editing
- **PC Kasir** (Linux Mint): 8GB RAM, 512GB SSD - untuk production deployment
- **Error terjadi di**: PC Kasir Linux Mint saat menjalankan `mulai-pos.sh`

---

## 🐛 Error yang Ditemukan

### 1. **USB Device Error**
```
Error response from daemon: weird gathering device information while adding custom device "/dev/usb/lp0": no such file or directory
```

**Penyebab**: Docker mencoba mount perangkat USB printer yang tidak ada.

**Status**: ✅ **SUDAH DIPERBAIKI**

### 2. **Credential Decryption Error**
```
failed to solve: error getting credentials - err: exit status 1, out: exit status 2: gpg: public key decryption failed: No such file or directory
```

**Penyebab**: Docker Desktop credential helper (GPG) bermasalah.

**Status**: ✅ **SOLUSI TERSEDIA**

---

## ✅ Solusi Lengkap

### **Opsi 1: Quick Fix (Tercepat)**

Jalankan script perbaikan baru yang sudah dibuat:

```bash
# Di terminal Linux Mint
cd "/mnt/c/Users/lenov/Documents/My Web/Warung-Rafilah"
chmod +x mulai-pos-fix.sh
./mulai-pos-fix.sh
```

Script ini akan:
- ✅ Cek Docker status
- ✅ Stop container lama
- ✅ Bersihkan cache yang bermasalah
- ✅ Build ulang image dengan cara yang benar
- ✅ Start semua services

---

### **Opsi 2: Manual Step-by-Step**

Jika ingin memahami setiap langkah:

#### **Langkah 1: Fix Docker Credential Helper**

```bash
# Backup config Docker
cp ~/.docker/config.json ~/.docker/config.json.backup

# Edit config, hapus baris "credsStore"
nano ~/.docker/config.json
```

Ubah dari:
```json
{
  "auths": {},
  "credsStore": "desktop",
  ...
}
```

Menjadi:
```json
{
  "auths": {},
  ...
}
```

Atau jalankan command ini untuk otomatis:
```bash
sed -i '/"credsStore":/d' ~/.docker/config.json
```

#### **Langkah 2: Bersihkan Docker Cache**

```bash
# Hapus container dan image lama
docker compose -f docker-compose.yml down
docker builder prune -f
```

#### **Langkah 3: Build Ulang Image**

```bash
# Build NextJS image tanpa cache
docker compose -f docker-compose.yml build --no-cache pos_nextjs

# Pull image lainnya
docker compose -f docker-compose.yml pull
```

#### **Langkah 4: Start Services**

```bash
# Start dengan override Linux
docker compose -f docker-compose.yml -f docker-compose.linux.yml up -d

# Cek status
docker compose ps
```

#### **Langkah 5: Verifikasi**

```bash
# Cek logs
docker compose logs -f pos_nextjs

# Buka browser ke http://localhost:3000
```

---

### **Opsi 3: Reset Total (Jika Masih Error)**

Jika kedua opsi di atas masih gagal:

```bash
# 1. Stop semua container
docker compose down

# 2. Hapus SEMUA Docker images dan cache
docker system prune -a --volumes

# 3. Restart Docker Desktop
# Tutup dan buka lagi Docker Desktop dari menu

# 4. Jalankan script fix
./mulai-pos-fix.sh
```

---

## 📋 Checklist Troubleshooting

Jika masih ada error, cek satu per satu:

### ✅ Prerequisites
- [ ] Docker Desktop sudah running
- [ ] File `.env` sudah ada (copy dari `.env.example` jika belum)
- [ ] Koneksi internet stabil
- [ ] Disk space minimal 10GB tersedia

### 🔍 Diagnostic Commands

```bash
# Cek Docker berjalan
docker info

# Cek Docker Compose version
docker compose version

# Cek file yang diperlukan
ls -la docker-compose*.yml .env

# Cek logs detail
docker compose logs --tail=50

# Cek resource usage
docker stats --no-stream
```

### 🚨 Error Spesifik

| Error | Solusi |
|-------|--------|
| `Cannot connect to Docker daemon` | Start Docker Desktop terlebih dahulu |
| `port already in use` | Ada service lain di port 3000/5432, stop dulu atau ganti port |
| `connection refused` | Tunggu 30 detik, database mungkin masih initializing |
| `out of memory` | Tambah RAM limit di Docker Desktop settings |

---

## 🎯 Hasil Akhir yang Diharapkan

Setelah berhasil, kamu akan lihat:

```
✅ POS Warung Rafilah berhasil dijalankan!

📍 URL Akses:
   - POS Web App : http://localhost:3000
   - n8n Workflow: http://localhost:5678
   - WAHA API    : http://localhost:3001
```

Container yang running:
```
NAME              STATUS         PORTS
pos_nextjs        Up (healthy)   0.0.0.0:3000->3000/tcp
pos_postgres      Up (healthy)   127.0.0.1:5432->5432/tcp
pos_n8n           Up             127.0.0.1:5678->5678/tcp
pos_waha          Up             127.0.0.1:3001->3000/tcp
pos_cloudflared   Up
```

---

## 📞 Bantuan Lebih Lanjut

Jika masih ada masalah:

1. **Screenshot error** yang muncul
2. **Paste output** dari command:
   ```bash
   docker compose logs --tail=100 > error.log
   cat error.log
   ```
3. **Cek system info**:
   ```bash
   docker info > docker-info.txt
   free -h
   df -h
   ```

---

## 🔐 Catatan Keamanan

- USB printer device (`/dev/usb/lp0`) sudah **dinonaktifkan** di `docker-compose.linux.yml`
- Untuk mengaktifkan cash drawer:
  1. Colok printer USB
  2. Cek device: `ls -l /dev/usb/lp*`
  3. Update `.env`: `CASH_DRAWER_DEVICE=/dev/usb/lp0`
  4. Uncomment di `docker-compose.linux.yml`:
     ```yaml
     devices:
       - "${CASH_DRAWER_DEVICE}:${CASH_DRAWER_DEVICE}"
     ```
  5. Restart: `docker compose down && docker compose up -d`
