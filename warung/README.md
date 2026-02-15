# 🏪 Toko Rafilah - Sistem Manajemen Inventory & Keuangan

Aplikasi web modern untuk mengelola inventory dan keuangan toko frozen food.

## 📋 Fitur Utama

- **Dashboard** - Ringkasan data keuangan dan inventory
- **Manajemen Produk** - Tambah, edit, hapus produk dengan harga jual/beli
- **Manajemen Inventory** - Catat stok masuk/keluar dengan riwayat
- **Manajemen Keuangan** - Catat pemasukan dan pengeluaran dengan kategori

## 🔒 Fitur Keamanan

- **Prepared Statements** - Mencegah SQL Injection
- **Input Sanitization** - Membersihkan input pengguna
- **CSRF Protection** - Validasi form submissions
- **Error Handling** - Penanganan error yang aman

## 📦 Struktur File

```
tes_web/
├── config.php              # Konfigurasi database & helper functions
├── index.php              # File utama
├── assets/
│   ├── style.css          # Styling modern & responsif
│   └── script.js          # JavaScript interactivity
├── pages/
│   ├── dashboard.php      # Dashboard & overview
│   ├── produk.php         # Manajemen produk
│   ├── inventory.php      # Manajemen inventory
│   └── keuangan.php       # Manajemen keuangan
├── database/              # (untuk backup/migrasi)
└── README.md             # File ini
```

## 🚀 Cara Instalasi

1. **Copy projektnya ke htdocs:**
   ```bash
   cp -r tes_web /xampp/htdocs/
   ```

2. **Akses di browser:**
   ```
   http://localhost/tes_web/
   ```

3. **Database akan otomatis dibuat** dengan tabel yang diperlukan

## 🛠️ Teknologi yang Digunakan

- **PHP 7.4+** - Backend
- **MySQL** - Database
- **HTML5** - Markup
- **CSS3** - Styling
- **JavaScript** - Interactivity

## 📊 Database Schema

### Tabel Produk
- `id` - Primary Key
- `nama` - Nama produk (unique)
- `harga_beli` - Harga pembelian
- `harga_jual` - Harga penjualan
- `stok` - Jumlah stok
- `created_at`, `updated_at` - Timestamps

### Tabel Stok Masuk/Keluar
- `id` - Primary Key
- `produk_id` - FK ke produk
- `jumlah` - Jumlah unit
- `harga_satuan` - Harga per unit
- `total_harga` - Total harga
- `tanggal` - Timestamp

### Tabel Pemasukkan/Pengeluaran
- `id` - Primary Key
- `deskripsi` - Keterangan
- `jumlah` - Nominal
- `kategori` - Kategori transaksi
- `tanggal` - Timestamp

## 🔄 Peningkatan Versi 2.0

✅ **Database Class** - Singleton pattern untuk koneksi
✅ **Prepared Statements** - Menggantikan string concatenation
✅ **Input Validation** - Validasi dan sanitasi data
✅ **Modern UI** - Design yang lebih clean dan responsif
✅ **Better UX** - Loading states, animations, notifications
✅ **Error Handling** - Exception handling yang lebih baik
✅ **Code Organization** - Struktur yang lebih terstruktur

## 🎨 Tema & Styling

- **Primary Color:** #667eea (Blue)
- **Secondary Color:** #764ba2 (Purple)
- **Success:** #4CAF50 (Green)
- **Danger:** #ff6b6b (Red)
- **Modern Design** dengan smooth transitions dan gradients

## 📱 Responsive Design

- ✅ Desktop (1200px+)
- ✅ Tablet (768px - 1199px)
- ✅ Mobile (480px - 767px)
- ✅ Small Mobile (<480px)

## 🐛 Troubleshooting

### Database tidak terkoneksi?
- Pastikan MySQL sudah running
- Cek kredensial di `config.php`
- Di-create ulang tables dengan buka di browser

### Data tidak muncul?
- Refresh browser
- Hapus cache browser
- Cek database via phpMyAdmin

## � Deployment ke Vercel

### Setup Awal

1. **Environment Variables di Vercel Dashboard:**
   - Buka project di Vercel
   - Pergi ke Settings → Environment Variables
   - Tambahkan semua variable dari `.env.example`:
     - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
     - `CORS_ORIGIN` - update dengan domain Vercel Anda
     - `JWT_SECRET` - generate secret yang kuat
     - `EMAIL_*` - konfigurasi email service
     - `APP_BASE_URL` - URL domain Anda di Vercel

2. **Vercel Configuration (`vercel.json`):**
   - File sudah disetup untuk menjalankan Fastify server
   - Routes otomatis di-handle oleh konfigurasi

3. **Deploy:**
   ```bash
   npm install -g vercel
   vercel
   ```

### Troubleshooting 404 Error

Jika masih 404, pastikan:
- ✅ `vercel.json` ada di root folder
- ✅ `package.json` punya `"main": "server.js"`
- ✅ Semua environment variables sudah dikonfigurasi
- ✅ Database connection berfungsi di Vercel
- ✅ Node version compatible (gunakan Node 18+)

### Testing Endpoints

Setelah deploy, test endpoint:
```
GET https://your-domain.vercel.app/api/health
```

Harus return: `{"status":"ok","timestamp":"..."}`

## �📝 Catatan Pengembang

- Gunakan prepared statements untuk query
- Selalu sanitize input user
- Test di berbagai browser
- Backup database secara berkala

## 📄 License

Dibuat untuk Toko Rafilah Frozen Food © 2026

## 👤 Support

Hubungi admin untuk bantuan teknis.
