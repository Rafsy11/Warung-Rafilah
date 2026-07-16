#!/bin/bash
# ============================================================
#  start-pos.sh — Script utama menjalankan POS Warung Rafilah
#  Dijalankan di: Linux Mint (PC Kasir)
# ============================================================

set -euo pipefail

cd "$(dirname "$0")"

COMPOSE_FILES="-f docker-compose.yml"
[ -f "docker-compose.linux.yml" ] && COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.linux.yml"

BANNER="
╔══════════════════════════════════════════╗
║   🛒  POS Warung Rafilah  — START        ║
╚══════════════════════════════════════════╝
"
echo "$BANNER"

# ── 1. Tolak sudo ────────────────────────────────────────────
if [ "$EUID" -eq 0 ]; then
    echo "❌  ERROR: Jangan jalankan script ini dengan 'sudo'!"
    echo "    Jalankan: ./start-pos.sh"
    exit 1
fi

# ── 2. Cek Docker aktif ──────────────────────────────────────
echo "🔍 Mengecek Docker..."
if ! docker info > /dev/null 2>&1; then
    echo ""
    echo "❌  Docker tidak aktif atau tidak terinstal."
    echo ""
    echo "   Solusi:"
    echo "   • Buka aplikasi Docker Desktop lewat menu, lalu tunggu sampai hijau"
    echo "   • ATAU jalankan: sudo systemctl start docker"
    echo ""
    exit 1
fi
echo "   ✅ Docker aktif"

# ── 3. Cek file .env ─────────────────────────────────────────
echo "🔍 Mengecek file konfigurasi .env..."
if [ ! -f ".env" ]; then
    echo ""
    echo "❌  File .env tidak ditemukan!"
    echo "    Copy dari .env.bak dan isi konfigurasi yang diperlukan:"
    echo "    cp .env.bak .env"
    echo ""
    exit 1
fi
echo "   ✅ File .env ditemukan"

# ── 4. Validasi variabel wajib di .env ───────────────────────
echo "🔍 Validasi variabel .env..."
REQUIRED_VARS=(POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB JWT_SECRET)
MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
    val=$(grep -E "^${var}=" .env | cut -d= -f2- | tr -d '[:space:]')
    if [ -z "$val" ]; then
        MISSING+=("$var")
    fi
done

if [ ${#MISSING[@]} -ne 0 ]; then
    echo ""
    echo "❌  Variabel berikut KOSONG di file .env:"
    for m in "${MISSING[@]}"; do
        echo "    • $m"
    done
    echo ""
    echo "    Harap isi variabel tersebut di file .env lalu jalankan ulang."
    exit 1
fi
echo "   ✅ Semua variabel wajib tersedia"

# ── 5. Cek CUPS socket (opsional, untuk printer) ─────────────
if [ -f "docker-compose.linux.yml" ]; then
    if [ ! -S "/var/run/cups/cups.sock" ]; then
        echo ""
        echo "⚠️  CUPS socket tidak ditemukan (/var/run/cups/cups.sock)."
        echo "   Printer mungkin tidak berfungsi."
        echo "   Solusi: sudo systemctl start cups"
        echo "   (Script tetap lanjut...)"
        echo ""
        # Nonaktifkan override linux agar tidak crash karena socket hilang
        COMPOSE_FILES="-f docker-compose.yml"
    fi
fi

# ── 6. Stop container lama (graceful) ────────────────────────
echo ""
echo "🛑 Menghentikan container lama (jika ada)..."
docker compose $COMPOSE_FILES down --remove-orphans 2>/dev/null || true
echo "   ✅ Selesai"

# ── 7. Pull image terbaru ─────────────────────────────────────
echo ""
echo "📥 Memperbarui image Docker..."
docker compose $COMPOSE_FILES pull
echo "   ✅ Image up-to-date"

# ── 8. Build pos_nextjs ───────────────────────────────────────
echo ""
echo "🔨 Build aplikasi POS (NextJS)..."
if ! docker compose $COMPOSE_FILES build pos_nextjs; then
    echo ""
    echo "❌  Build GAGAL!"
    echo ""
    echo "   Troubleshooting:"
    echo "   1. Pastikan koneksi internet stabil"
    echo "   2. Coba: docker builder prune -f  lalu jalankan ulang"
    echo "   3. Coba: docker system prune -a   (reset total)"
    exit 1
fi
echo "   ✅ Build berhasil"

# ── 9. Start semua services ───────────────────────────────────
echo ""
echo "▶️  Menyalakan semua services..."
docker compose $COMPOSE_FILES up -d

# ── 10. Tunggu + health check ─────────────────────────────────
echo ""
echo "⏳ Menunggu services siap (15 detik)..."
sleep 15

echo ""
echo "🏥 Status container:"
docker compose $COMPOSE_FILES ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

# ── 11. Cek apakah ada container yang tidak Running ───────────
UNHEALTHY=$(docker compose $COMPOSE_FILES ps --format json 2>/dev/null \
    | python3 -c "
import sys, json
lines = sys.stdin.read().strip().splitlines()
bad = []
for l in lines:
    try:
        c = json.loads(l)
        if 'Exit' in c.get('Status','') or 'error' in c.get('Status','').lower():
            bad.append(c.get('Name','?'))
    except:
        pass
print('\n'.join(bad))
" 2>/dev/null || true)

if [ -n "$UNHEALTHY" ]; then
    echo ""
    echo "⚠️  Container berikut mungkin bermasalah:"
    echo "$UNHEALTHY"
    echo ""
    echo "   Cek log dengan: docker logs <nama_container>"
fi

# ── 12. Selesai ───────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✅  POS Warung Rafilah berhasil dijalankan!         ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  🌐  POS Web App   : http://localhost:3000           ║"
echo "║  🔄  n8n Workflow  : http://localhost:5678           ║"
echo "║  💬  WAHA API      : http://localhost:3001           ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  📋  Lihat log : docker compose logs -f              ║"
echo "║  🛑  Matikan   : ./matikan-pos.sh                    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
read -p "Tekan [Enter] untuk menutup jendela ini..."
