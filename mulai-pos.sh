#!/bin/bash
# Script untuk menjalankan POS di Linux Mint

# Pastikan dijalankan dari folder tempat script berada
cd "$(dirname "$0")"

# 1. CEK: Apakah dijalankan dengan sudo?
if [ "$EUID" -eq 0 ]; then
    echo "⚠️  PERINGATAN: Anda menjalankan script ini dengan 'sudo'."
    echo "Jika Anda menggunakan Docker Desktop, Docker berjalan di level USER biasa."
    echo "Menjalankan dengan sudo akan menyebabkan error koneksi socket."
    echo ""
    read -p "Tetap lanjut dengan sudo? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Silakan jalankan kembali TANPA sudo: ./mulai-pos.sh"
        exit 1
    fi
fi

echo "🔍 Memeriksa status Docker..."

# 2. Coba cek apakah perintah docker responsif
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker daemon tidak merespon."
    
    # Deteksi jika menggunakan Docker Desktop
    if systemctl --user list-unit-files | grep -q "docker-desktop"; then
        echo "Memulai Docker Desktop untuk Linux..."
        systemctl --user start docker-desktop
        
        # Tunggu sampai socket siap
        echo "⏳ Menunggu Docker Desktop siap (maks 30 detik)..."
        for i in {1..10}; do
            if docker info >/dev/null 2>&1; then
                echo "✓ Docker Desktop siap!"
                break
            fi
            sleep 3
        done
    else
        # Fallback ke Docker CE (System-wide)
        echo "Mencoba mengaktifkan service system-wide Docker..."
        sudo systemctl start docker
    fi
fi

# Cek akhir setelah percobaan start
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker masih belum aktif. Harap buka aplikasi Docker Desktop lewat menu Linux Mint Anda terlebih dahulu!"
    read -p "Tekan [Enter] untuk keluar..."
    exit 1
fi

# Tentukan file docker compose yang akan digunakan
COMPOSE_CMD="docker compose -f docker-compose.yml"
if [ -f "docker-compose.linux.yml" ]; then
    COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.linux.yml"
fi

# Cek status koneksi internet (Hybrid Online/Offline)
IS_ONLINE=false
if ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1 || curl -s --connect-timeout 2 https://1.1.1.1 >/dev/null 2>&1; then
    IS_ONLINE=true
fi

if [ "$IS_ONLINE" = true ]; then
    echo "📥 Mode ONLINE: Menarik/memperbarui image docker..."
    $COMPOSE_CMD pull || echo "⚠️ Gagal pull image online, menggunakan image lokal yang tersimpan."
else
    echo "⚡ Mode OFFLINE: Melewati update image online, menggunakan image lokal."
fi

echo "▶️  Menyalakan server POS..."
if ! $COMPOSE_CMD up -d; then
    echo "⚠️  Terdeteksi kendala container lama, melakukan pemulihan otomatis..."
    $COMPOSE_CMD down --remove-orphans 2>/dev/null || true
    $COMPOSE_CMD up -d
fi

echo "⏳ Menunggu database & web app siap..."
READY=false
for i in {1..20}; do
    if curl -s --connect-timeout 1 http://localhost:3000/api/health >/dev/null 2>&1; then
        READY=true
        break
    fi
    sleep 1
done

if [ "$READY" = true ]; then
    echo "✅ POS Warung Rafilah berhasil dijalankan & siap digunakan!"
    echo "Akses di browser PC Kasir: http://localhost:3000"
else
    echo "⚠️  Layanan sedang dimulai di latar belakang..."
    echo "Akses di browser PC Kasir: http://localhost:3000"
fi
read -p "Tekan [Enter] untuk menutup jendela ini..."

