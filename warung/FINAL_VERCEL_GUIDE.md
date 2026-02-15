# 🚀 Langkah Final Deploy ke Vercel

## ✅ File Configuration Sudah Siap

- ✅ `api/index.js` - Handler untuk Vercel
- ✅ `vercel.json` - Routing configuration
- ✅ `server.js` - Local development server
- ✅ Routes di `routes/` folder

---

## 📋 PUSH TO GITHUB & DEPLOY

### Step 1: Commit & Push Changes
```powershell
cd c:\xampp\htdocs\warung
git add .
git commit -m "Fix: Vercel serverless setup with fastify inject"
git push origin main
```

### Step 2: Wait for Auto-Deploy
- Vercel auto-deploy jika sudah connect ke GitHub
- Tunggu ~2-3 menit sampai deployment selesai
- Cek status di https://vercel.com dashboard

### Step 3: Test Endpoints Setelah Deploy

#### Test Root Endpoint
```
https://your-domain.vercel.app/
```
Should return:
```json
{
  "message": "Toko Rafilah API Server",
  "version": "1.0.0",
  "status": "running",
  "timestamp": "2026-02-15T..."
}
```

#### Test Health Endpoint
```
https://your-domain.vercel.app/api/health
```
Should return:
```json
{
  "status": "ok",
  "timestamp": "...",
  "environment": "production"
}
```

---

## 🔍 JIKA MASIH 404 - Debug Guide

### A. Check Build Logs (PENTING!)
1. Buka https://vercel.com
2. Pilih project Anda
3. Klik **Deployments** tab
4. Klik **deployment terakhir**
5. Klik **View Build Logs**
6. Scroll dan cari:
   - ❌ Errors: `ERROR`, `failed`, `not found`
   - ✅ Success: `Deployment complete`

**Apa yang dicari:**
- `npm install` - ada error tidak?
- `routes/` files - detected tidak?
- `api/index.js` - ada tidak?

### B. Check Function Logs (Saat Request)
1. Di Vercel deployment page sama
2. Klik **Function Logs** atau **Standby logs**
3. Buka URL di browser: `https://your-domain.vercel.app/`
4. Lihat logs yang muncul
5. Cari message:
   - Request received
   - Route match
   - Error message

### C. Test via Browser Console
```javascript
// Buka DevTools (F12) → Console, paste:
fetch('https://your-domain.vercel.app/')
  .then(r => {
    console.log('Status:', r.status);
    return r.json();
  })
  .then(data => console.log('Response:', data))
  .catch(err => console.error('Error:', err.message))
```

---

## 📊 Status Code Reference

| Code | Meaning | Action |
|------|---------|--------|
| 200 | ✅ Success | All good! |
| 404 | ❌ Not found | Route error |
| 500 | ❌ Server error | Check logs |
| 502/503 | ❌ Bad gateway | Vercel issue |

---

## 🆘 Common 404 Causes

1. **api/index.js tidak ada** → Upload file
2. **vercel.json syntax error** → Validate JSON
3. **Routes import error** → Check console logs
4. **Node version incompatible** → Set NODE_ENV
5. **Build fail** → Check build logs untuk error

---

## 📝 Info yang Perlu Diketahui

**Domain Vercel Anda:**
- Format: `project-name-username.vercel.app`
- Find di: Vercel Dashboard → Project → Domains

**Environment Variables sudah dikonfigurasi di sini:**
- Settings → Environment Variables
- Harus di-set setiap link GitHub baru

---

Silakan ikuti step-by-step di atas dan share build logs + function logs jika masih 404! 📋
