# DEBUGGING DEPLOYMENT DI VERCEL

## ✅ Sudah Diperbaiki

1. **Routes tidak di-await** - FIXED!
   - Sebelum: `fastify.register(authRoutes, ...)`
   - Sesudah: `await fastify.register(authRoutes, ...)`
   - Impact: Routes sekarang terdaftar dengan benar sebelum server start

2. **server.js** - Sudah menggunakan Fastify dengan routing yang benar

3. **vercel.json** - Sudah dikonfigurasi untuk handle semua routes

## 📝 Langkah Next: Push & Deploy

### 1. Push changes ke GitHub
```powershell
git add .
git commit -m "Fix: Add await to fastify.register routes"
git push origin main
```

### 2. Vercel akan auto-deploy (jika sudah connected to GitHub)

### 3. Setelah deploy, test endpoints:

**Test 1: Health Check (harus 200 OK)**
```
GET https://your-domain.vercel.app/api/health
```
Response yang diharapkan:
```json
{"status":"ok","timestamp":"2026-02-15T..."}
```

**Test 2: Login (harus ada response, bukan 404)**
```
POST https://your-domain.vercel.app/api/auth/login
Body: {"username":"test","password":"test"}
```
Response yang diharapkan:
```json
{
  "success": false,
  "message": "Username dan password harus diisi"
}
```
atau error database connection (bukan 404)

**Test 3: Produk List (harus ada response, bukan 404)**
```
GET https://your-domain.vercel.app/api/produk
```
Response yang diharapkan:
```json
{
  "success": false,
  "message": "..." (auth error atau database error, bukan 404)
}
```

## 🔍 Jika Masih 404

Cek hal ini di Vercel Dashboard:

1. **Build Logs** (Settings > Deployments > Klik latest > View Build Logs)
   - Cari error saat build
   - Cari error saat runtime

2. **Function Logs** (Lihat output saat request ke endpoint)
   - Lihat apakah server start dengan baik
   - Lihat apakah ada error saat route registration

3. **Network** di browser DevTools
   - Apakah request sampai ke Vercel?
   - Berapa status code? (404, 500, timeout?)

## 🆘 Jika Masih Gagal

Cek:
1. Apakah `await` sudah ditambah di semua `fastify.register(routes)`?
2. Apakah vercel.json syntax benar? (gunakan JSON validator)
3. Apakah ada error di imports routes (misal: `import ... from '../lib/db.js'`)?
4. Apakah database bisa diakses? (sekan akan gagal jika DB down)

Print output dari Vercel logs dan share di sini! 📋
