#!/bin/bash
# Script untuk menghentikan POS di Linux Mint

# Pastikan dijalankan dari folder tempat script berada
cd "$(dirname "$0")"

echo "🛑 Menghentikan server POS secara aman..."
docker compose down

echo "✅ POS Warung Rafilah berhasil dimatikan."
read -p "Tekan [Enter] untuk menutup jendela ini..."
