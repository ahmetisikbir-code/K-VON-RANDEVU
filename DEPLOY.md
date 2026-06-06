# KIVON Deploy Rehberi

## 1. Frontend Deploy (kivon-web → kivontr.com)

**GitHub Pages ile otomatik deploy** — `kivon-web/.github/workflows/deploy.yml` var:
- `main` branch'ine push atınca **otomatik** GitHub Pages'e deploy eder
- Custom domain: `kivontr.com` (CNAME dosyası ile)
- Manuel trigger: GitHub repo → Actions → "Deploy to GitHub Pages" → "Run workflow"

### Manuel adımlar (değişiklik yapınca):
```powershell
cd C:\Users\ahmet\OneDrive\Belgeler\kivon-web

# Durum kontrol
git status

# Değişen dosyaları stage et
git add randevu/          # randevu sistemi sayfaları
git add css/              # stil değişiklikleri
git add js/               # JS değişiklikleri

# Ya da tümünü tek seferde
git add -A

# Commit & push
git commit -m "ne degisti?"
git push
```

### Otomatik deploy akışı:
1. `git push` → GitHub Actions tetiklenir
2. `actions/upload-pages-artifact` ile tüm site artifact olarak yüklenir
3. `actions/deploy-pages` ile GitHub Pages'e deploy edilir
4. ~1-2 dk içinde `https://kivontr.com`'da canlı olur

### Sık deploy edilen dosyalar:
| Dosya | Açıklama |
|-------|----------|
| `randevu/admin.html` | Admin panel |
| `randevu/kayit.html` | Kayıt sayfası |
| `randevu/giris.html` | Giriş sayfası |
| `randevu/js/api.js` | API bağlantıları |
| `randevu/js/i18n.js` | Dil dosyaları (Türkçe/İngilizce) |
| `randevu/css/style.css` | Stiller |

---

## 2. Backend Deploy

### Şu anki durum: Local'de çalışıyor
```powershell
cd C:\Users\ahmet\OneDrive\Belgeler\kivon-randevu\backend
npm install
node src/index.js
# => http://localhost:3000
```

### Seçenek A: Render.com (ücretsiz) — Önerilen
`render.yaml` hazır, tek tıkla deploy:
1. https://render.com → "New Web Service" → "Blueprint"
2. GitHub repo'nu bağla (kivon-randevu)
3. Render, `render.yaml`'ı otomatik okuyup servisi kurar
4. `SUPABASE_SERVICE_KEY` ve `JWT_SECRET`'i manuel gir (sync: false)

Render URL: `https://kivon-randevu-api.onrender.com`

### Seçenek B: Fly.io (ücretsiz tier)
```powershell
flyctl launch --region fra
flyctl secrets set SUPABASE_URL=... SUPABASE_SERVICE_KEY=...
flyctl deploy
```

### Seçenek C: VPS (üretim için)
| Sağlayıcı | Fiyat | Özellik |
|-----------|-------|---------|
| Hetzner CX22 | ~€8/ay | 2 vCPU, 4GB RAM |
| DigitalOcean | $12/ay | 1 vCPU, 2GB RAM |

VPS kurulum:
```bash
# Ubuntu 22.04
apt update && apt install -y nodejs npm nginx
git clone https://github.com/K-VON-RANDEVU repo
cd backend && npm install
# PM2 ile serve et
npm install -g pm2
pm2 start src/index.js --name kivon-api
pm2 save && pm2 startup
```

---

## 3. WhatsApp Bot Çalıştırma

### Local'de başlatma:
```powershell
cd C:\Users\ahmet\OneDrive\Belgeler\kivon-randevu\whatsapp-bot
node index.js
```

### Başarılı başlatma çıktısı:
```
╔══════════════════════════════════════╗
║   KIVON WhatsApp Randevu Asistani   ║
╚══════════════════════════════════════╝
✅ Bot baslatildi. Mesajlari dinliyor...
Durmak icin Ctrl+C
```

### Bot bağlantı kontrolü:
- QR kodu terminalde görünürse → WhatsApp ile tara
- "Baglandi: ..." mesajı gelirse bağlantı tamam
- Bağlantı koptuğunda bot otomatik yeniden dener

### 7/24 çalışması için VPS gerekli
Bot `whatsapp-web.js` kullanır (headless WhatsApp). VPS'de:
```bash
# Ubuntu'da Chromium gerekli
apt install -y chromium-browser

# PM2 ile background'da çalıştır
pm2 start whatsapp-bot/index.js --name kivon-bot
pm2 save
```

---

## 4. Canlı Öncesi Kontrol Listesi

- [ ] **RLS politikaları uygulandı mı?** Supabase SQL Editor'da `backend/supabase/schema.sql` çalıştırıldı mı?
- [ ] **Demo klinik verileri hazır mı?** Supabase `doctors` tablosuna test doktoru eklendi mi?
- [ ] **WhatsApp bot çalışıyor mu?** `node index.js` ile başlıyor mu, QR bağlantısı tamam mı?
- [ ] **Kayıt sayfası çalışıyor mu?** `https://kivontr.com/randevu/kayit.html` açılıyor mu?
- [ ] **Admin panel çalışıyor mu?** `https://kivontr.com/randevu/admin.html` giriş yapılabiliyor mu?
- [ ] **i18n düzgün mü?** Türkçe/İngilizce dil geçişi çalışıyor mu?
- [ ] **Mobil uyumlu mu?** Tüm sayfalar mobil görünümde test edildi mi?
- [ ] **Backend bağlantısı var mı?** Frontend'deki `api.js` doğru backend URL'ini gösteriyor mu?
- [ ] **.env dosyaları git'te değil mi?** `*.env` `.gitignore`'da var, kontrol et.
- [ ] **Supabase bağlantısı çalışıyor mu?** Backend loglarında hata var mı?

---

## 5. Hızlı Deploy Komutları

```powershell
# ─── FRONTEND DEPLOY ───
cd C:\Users\ahmet\OneDrive\Belgeler\kivon-web
git add randevu/ css/ js/
git commit -m "randevu sistemi guncelleme"
git push
# Otomatik GitHub Pages deploy başlar (1-2 dk)

# ─── BACKEND BAŞLAT (local) ───
cd C:\Users\ahmet\OneDrive\Belgeler\kivon-randevu\backend
node src/index.js

# ─── WHATSAPP BOT BAŞLAT ───
cd C:\Users\ahmet\OneDrive\Belgeler\kivon-randevu\whatsapp-bot
node index.js

# ─── TÜMÜNÜ TEK SEFERDE BAŞLAT ───
# (Admin PowerShell)
Start-Process powershell -ArgumentList "cd C:\Users\ahmet\OneDrive\Belgeler\kivon-randevu\backend; node src/index.js"
Start-Process powershell -ArgumentList "cd C:\Users\ahmet\OneDrive\Belgeler\kivon-randevu\whatsapp-bot; node index.js"
```

---

## Mimari Özet

```
kivontr.com (GitHub Pages)
  └── /randevu/           ← statik frontend (HTML/CSS/JS)
        ├── admin.html     ← doktor/admin paneli
        ├── kayit.html     ← hasta kayıt
        ├── giris.html     ← giriş
        └── js/api.js      → backend API çağrıları

Backend (Render / VPS)
  └── Express API :3000
        ├── /api/auth/*    ← Supabase Auth
        ├── /api/appointments/* ← CRUD
        └── /api/whatsapp  ← Webhook

WhatsApp Bot (VPS - 7/24)
  └── whatsapp-web.js
        ├── Supabase bağlantısı
        └── AI mesaj yanıtlama

Supabase (Bulut - ücretsiz)
  ├── Auth (email/şifre)
  ├── PostgreSQL (profiles, doctors, appointments)
  └── RLS politikaları
```
