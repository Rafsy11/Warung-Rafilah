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

echo "📥 Menarik/memperbarui image docker..."
$COMPOSE_CMD pull

echo "🔨 Build image NextJS..."
# Build tanpa cache untuk menghindari error credential
$COMPOSE_CMD build --no-cache pos_nextjs 2>&1 | grep -v "credential" || true

echo "▶️  Menyalakan server POS..."
$COMPOSE_CMD up -d

echo "⏳ Menunggu server siap..."
sleep 5

echo "✅ POS Warung Rafilah berhasil dijalankan!"
echo "Akses di browser PC Kasir: http://localhost:3000"
read -p "Tekan [Enter] untuk menutup jendela ini..."

