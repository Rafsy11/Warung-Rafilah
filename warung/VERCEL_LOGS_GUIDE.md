# Cara Check Logs di Vercel

## 🔍 Step-by-Step Check Logs

### 1. Build Logs (saat deployment)
```
1. Buka https://vercel.com
2. Login dengan GitHub account
3. Pilih project "warung" (atau nama project Anda)
4. Klik "Deployments" tab
5. Klik deployment paling baru (di atas)
6. Klik "View Build Logs"
7. Scroll dan lihat output npm install, build, dll
```

**Yang dicari:**
- ❌ ERROR saat `npm install`
- ❌ ERROR saat build
- ❌ Module not found
- ✅ "Build completed successfully"

---

### 2. Function Logs (saat request)
```
1. Buka https://vercel.com
2. Tentukan project → Deployments → latest deployment
3. Klik "View Function Logs" atau "Inspect"
4. Buka endpoint di browser/Postman
5. Lihat logs yang muncul
```

**Yang dicari:**
- Request method dan URL yang diterima
- Status code response
- Error message jika ada

---

## 🔧 Test Endpoints

### Test 1: Root endpoint
```
GET https://your-domain.vercel.app/
```
Expected: 200 OK dengan JSON response

### Test 2: Health check
```
GET https://your-domain.vercel.app/api/health
```
Expected: 200 OK dengan `{"status":"ok",...}`

### Test 3: Login (akan error database, tapi bukan 404)
```
POST https://your-domain.vercel.app/api/auth/login
Body: {"username":"test","password":"test"}
```
Expected: ~500 atau auth error (bukan 404)

---

## 📱 Cara Test dengan Browser Console

```javascript
// Di browser console (F12)
fetch('https://your-domain.vercel.app/')
  .then(r => r.json())
  .then(console.log)
  .catch(e => console.error('Error:', e.message))
```

---

## ⏱️ Vercel Logs Retention
- Build logs: tersimpan selamanya
- Function logs: tersimpan 7 hari
- Jika mau lihat old logs, harus lihat saat deployment baru dilakukan

---

## 💡 Common Issues

| Issue | Cek |
|---|---|
| Build error | Build Logs → cari ERROR |
| 404 everything | Function Logs → route tidak match |
| 500 error | Function Logs → setup/require error |
| Database error | Logs menunjukkan connection refused |

---

Silakan cek logs dan share hasil-nya! 📋
