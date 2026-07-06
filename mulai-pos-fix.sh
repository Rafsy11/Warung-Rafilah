#!/bin/bash
# Script FIXED untuk menjalankan POS di Linux Mint
# Mengatasi masalah credential dan USB device

set -e  # Exit on error

cd "$(dirname "$0")"

echo "🚀 POS Warung Rafilah - Startup Script (FIXED)"
echo "================================================"

# 1. CEK: Apakah dijalankan dengan sudo?
if [ "$EUID" -eq 0 ]; then
    echo "⚠️  PERINGATAN: Script ini dijalankan dengan 'sudo'."
    echo "Untuk Docker Desktop, sebaiknya TANPA sudo."
    echo ""
    read -p "Tetap lanjut? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Silakan jalankan kembali tanpa sudo: ./mulai-pos-fix.sh"
        exit 1
    fi
fi

# 2. Cek Docker
echo "🔍 Memeriksa Docker..."
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker tidak aktif!"
    echo "Silakan buka Docker Desktop terlebih dahulu."
    exit 1
fi
echo "✅ Docker aktif"

# 3. Cek file .env
if [ ! -f ".env" ]; then
    echo "❌ File .env tidak ditemukan!"
    echo "Copy dari .env.example dan isi konfigurasi yang diperlukan."
    exit 1
fi
echo "✅ File .env ada"

# 4. Stop container lama jika ada
echo ""
echo "🛑 Menghentikan container lama..."
docker compose -f docker-compose.yml -f docker-compose.linux.yml down 2>/dev/null || true

# 5. Bersihkan credential cache (fix error GPG)
echo ""
echo "🧹 Membersihkan cache Docker..."
docker builder prune -f >/dev/null 2>&1 || true

# 6. Build image dengan error handling
echo ""
echo "🔨 Building POS NextJS image..."
echo "   (Ini mungkin memakan waktu 2-5 menit...)"

# Build dengan flag yang aman
if docker compose -f docker-compose.yml build --no-cache pos_nextjs; then
    echo "✅ Build berhasil!"
else
    echo "❌ Build gagal!"
    echo ""
    echo "Troubleshooting:"
    echo "1. Pastikan internet stabil (untuk download dependencies)"
    echo "2. Cek apakah ada Docker Desktop update yang pending"
    echo "3. Coba restart Docker Desktop"
    echo "4. Jalankan: docker system prune -a (untuk reset total)"
    exit 1
fi

# 7. Pull image lainnya
echo ""
echo "📥 Downloading service images lainnya..."
docker compose -f docker-compose.yml pull

# 8. Start semua services
echo ""
echo "▶️  Memulai semua services..."
docker compose -f docker-compose.yml -f docker-compose.linux.yml up -d

# 9. Tunggu services ready
echo ""
echo "⏳ Menunggu services siap (30 detik)..."
sleep 10

# Check health
echo ""
echo "🏥 Checking service health..."
docker compose -f docker-compose.yml ps

echo ""
echo "✅ POS Warung Rafilah berhasil dijalankan!"
echo ""
echo "📍 URL Akses:"
echo "   - POS Web App : http://localhost:3000"
echo "   - n8n Workflow: http://localhost:5678"
echo "   - WAHA API    : http://localhost:3001"
echo ""
echo "📝 Monitoring:"
echo "   - Lihat logs  : docker compose -f docker-compose.yml logs -f"
echo "   - Stop system : docker compose -f docker-compose.yml down"
echo ""
read -p "Tekan [Enter] untuk menutup..."
