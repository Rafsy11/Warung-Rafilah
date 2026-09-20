# Update aman Warung Rafilah — Linux Mint

Update ini menambahkan struktur database melalui migrasi 022. Data transaksi, produk, bon, stok, pengguna, dan riwayat lama tidak dihapus atau diisi ulang. PIN lama tidak diganti otomatis. Volume Docker dan `.env` tetap digunakan. Nilai modal historis yang tidak pernah dicatat tidak ditebak; laporan menandainya sebagai data yang belum diketahui.

## Sebelum update

1. Selesaikan atau batalkan pembayaran QRIS tertunda sesuai mutasi pembayaran yang sebenarnya, lalu tutup semua shift. Jangan melakukan transaksi selama update.
2. Sambungkan USB/disk backup terpisah. Buat folder khusus backup di perangkat tersebut. Folder lain pada filesystem proyek yang sama akan ditolak. Gunakan perangkat fisik berbeda, bukan sekadar partisi pada disk yang sama.
3. Pastikan Docker Desktop berjalan, ruang disk cukup untuk image baru, backup, dan satu salinan database. Simpan `.env` secara aman di luar Git juga; dump database tidak mencakup `.env`, file konfigurasi, atau file sesi WhatsApp.
4. Perubahan kode harus sudah tersedia di remote Git sebelum `git pull`. Perubahan yang hanya ada di komputer pengembang belum bisa ditarik oleh PC kasir.

## Menjalankan update

Dari folder proyek di Linux Mint, ganti contoh lokasi USB dengan folder yang benar-benar terpasang:

```bash
git pull --ff-only
export POS_DOCKER_CONTEXT=desktop-linux
export BACKUP_MIRROR_DIR="/media/$USER/NAMA_USB/backup-pos"
bash deploy-update.sh
```

Jika instalasi menggunakan Docker Engine, tentukan konteks yang benar dari `docker context ls`, misalnya `default`. Jangan berpindah konteks sembarangan: setiap konteks dapat memiliki volume database berbeda.

Script memeriksa shift, mempertahankan image lama dengan tag `warung-pos-rollback:...`, membangun image baru, menghentikan POS dan n8n, membuat dump PostgreSQL, serta memverifikasi salinan backup eksternal. Setelah itu script:

1. Me-restore dump ke database sementara dengan nama `pos_restore_check_...`.
2. Menjalankan migrasi dua kali pada salinan itu.
3. Membandingkan jumlah dan isi seluruh kolom lama di tabel operasional `core`, `warung`, dan `agent`.
4. Hanya jika seluruh pemeriksaan lolos, menjalankan migrasi pada database asli dan memeriksa kesiapan aplikasi.

Jika tabel lama berubah, restore gagal, migrasi gagal, atau server belum siap, proses berhenti dengan pesan kesalahan. Database sementara dibuang; database asli tidak di-restore otomatis. Migrasi lama yang belum pernah diterapkan dapat menyebabkan pemeriksaan menolak upgrade; jangan mengakalinya dengan mengubah penanda migrasi.

`git pull` sendiri hanya memperbarui file kode. Startup image baru hanya memeriksa kesiapan skema dan tidak menjalankan migrasi otomatis. Untuk update gunakan script di atas, bukan hanya `docker compose up --build`. Jangan menjalankan `docker compose down -v`, menghapus volume `pgdata`, atau menjalankan ulang seed untuk mengatasi kegagalan.

## Setelah update

- Login ulang; sesi sebelum update tidak lagi diterima. Periksa transaksi lama, saldo bon, stok, serta laporan sebelum mulai berjualan.
- Lakukan transaksi kecil yang benar-benar terjadi dan periksa struk, DP/bon, pembayaran QRIS manual, dan penutupan shift. Pembayaran QRIS harus diverifikasi pada akun penerima sebelum dikonfirmasi di POS.
- Sertifikat HTTPS lokal dibuat ulang di `ssl/local-*.pem`; browser lokal mungkin meminta kepercayaan ulang. Private key tidak lagi disimpan di Git. Penghapusan file dari versi terbaru tidak menghapusnya dari riwayat Git.
- Simpan backup eksternal dan image lama sampai pemeriksaan operasional selesai. Backup rutin tetap diperlukan setelah upgrade; jangan menganggap backup sebelum update melindungi transaksi berikutnya.
- Akses melalui Cloudflare memerlukan internet; transaksi melalui alamat lokal tetap memerlukan server dan database lokal yang hidup. Keranjang tersimpan bukan bukti bahwa pembayaran sudah masuk database.

## Mengganti PIN/password admin yang lama

Jika sebelumnya memakai PIN bawaan yang pernah tercantum di kode, ganti setelah update. Perintah berikut tidak memasukkan password ke argumen proses atau riwayat shell:

```bash
source scripts/docker-context.sh
read -rsp 'Password admin baru (8–64 karakter): ' POS_NEW_PIN; echo
printf '%s' "$POS_NEW_PIN" | docker exec -i pos_nextjs node scripts/reset-admin-pin.mjs
unset POS_NEW_PIN
```

Sesi admin lama akan dicabut. Pembatasan login berdasarkan akun dan sesi yang dapat dicabut sudah diterapkan, tetapi pembatasan domain melalui Cloudflare Access tetap harus dikonfigurasi pada akun Cloudflare pemilik jika dibutuhkan. Update kode tidak mengubah konfigurasi akun tersebut.

## Backup rutin dan kegagalan update

Dengan USB terpasang, jalankan `BACKUP_MIRROR_DIR="/lokasi/backup" bash scripts/backup-db.sh`. Script berhenti bila dump atau penyalinan gagal. Script backup saja memeriksa format arsip; uji restore penuh dijalankan oleh prosedur deployment. Jadwal backup dan penyimpanan di luar PC perlu diatur pada Linux Mint; belum otomatis terpasang oleh perubahan kode ini.

Jika update berhenti setelah layanan dihentikan, simpan pesan error, lokasi dump, dan tag image rollback. Jangan mengulangi transaksi atau melakukan restore ke database asli tanpa pemeriksaan: restore dapat menghapus transaksi yang terjadi setelah waktu backup.

Untuk menjalankan kembali image lama setelah meninjau tahap kegagalan, buat file override lokal (jangan commit) dengan tag rollback yang dicetak script:

```yaml
services:
  pos_nextjs:
    image: warung-pos-rollback:TAG_DARI_OUTPUT
```

Gunakan konfigurasi Compose dan konteks Docker yang sama dengan instalasi:

```bash
source scripts/docker-context.sh
docker compose -f docker-compose.yml -f /lokasi/rollback.yml up -d --no-build --no-deps pos_nextjs n8n
```

Tambahkan `-f docker-compose.linux.yml` sebelum override jika memakai perangkat laci kasir. Migrasi 022 bersifat menambah struktur, tetapi penggunaan aplikasi lama tidak mengembalikan perbaikan keamanan/integritas di aplikasi baru. Jangan menghapus kolom/tabel baru sebagai langkah rollback. Bila kegagalan terkait data atau migrasi lama, periksa penyebab sebelum mengaktifkan kembali layanan.

## Batas verifikasi

Pengujian otomatis memakai database sementara dengan data uji. Backup produksi belum tersedia di komputer pengembang. Karena itu, kesesuaian dengan data nyata baru dipastikan oleh uji restore dan perbandingan salinan pada PC Linux Mint sebelum migrasi produksi dijalankan. Printer, laci kasir, USB, Cloudflare, dan pemulihan setelah mati listrik juga memerlukan verifikasi pada perangkat sebenarnya.
