#!/bin/bash
# Script untuk menghentikan POS di Linux Mint (Docker Desktop)

# Pastikan dijalankan dari folder tempat script berada
cd "$(dirname "$0")"

# Cek jika dijalankan dengan sudo (tidak perlu & bisa gagal di Docker Desktop)
if [ "$EUID" -eq 0 ]; then
    echo "⚠️  PERINGATAN: Jangan jalankan script ini dengan 'sudo'."
    echo "Docker Desktop berjalan di level user biasa."
    echo "Silakan jalankan ulang: ./matikan-pos.sh"
    read -p "Tekan [Enter] untuk keluar..."
    exit 1
fi

# Cek apakah Docker aktif
if ! docker info >/dev/null 2>&1; then
    echo "⚠️  Docker tidak aktif. Kontainer POS kemungkinan sudah mati."
    read -p "Tekan [Enter] untuk keluar..."
    exit 0
fi

# Tentukan file docker compose yang akan digunakan
COMPOSE_CMD="docker compose -f docker-compose.yml"
if [ -f "docker-compose.linux.yml" ]; then
    COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.linux.yml"
fi

echo "🛑 Menghentikan server POS secara aman..."
$COMPOSE_CMD down

if [ $? -eq 0 ]; then
    echo "✅ POS Warung Rafilah berhasil dimatikan."
    echo "Anda sekarang dapat mematikan PC Kasir dengan aman."
else
    echo "❌ Terjadi masalah saat menghentikan server. Coba jalankan:"
    echo "   $COMPOSE_CMD down"
fi

read -p "Tekan [Enter] untuk menutup jendela ini..."
