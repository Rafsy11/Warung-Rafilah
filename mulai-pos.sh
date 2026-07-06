#!/bin/bash
# Script untuk menjalankan POS di Linux Mint

# Pastikan dijalankan dari folder tempat script berada
cd "$(dirname "$0")"

echo "🔍 Memeriksa status Docker..."
if ! systemctl is-active --quiet docker; then
    echo "❌ Docker daemon tidak berjalan! Silakan hidupkan Docker Service."
    echo "Mencoba menjalankan: sudo systemctl start docker"
    sudo systemctl start docker
fi

echo "📥 Menarik/memperbarui image docker..."
docker compose pull

echo "▶️  Menyalakan server POS..."
docker compose up -d

echo "⏳ Menunggu server siap..."
sleep 5

echo "✅ POS Warung Rafilah berhasil dijalankan!"
echo "Akses di browser PC Kasir: http://localhost:3000"
read -p "Tekan [Enter] untuk menutup jendela ini..."
