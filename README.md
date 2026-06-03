# KIVON Randevu — WhatsApp AI Randevu Sistemi

AI destekli WhatsApp randevu sistemi. Kullanıcılar WhatsApp üzerinden AI asistanla konuşarak randevu alır, takvim otomatik kontrol edilir.

## Mimari

```
kivon-randevu/
├── frontend/          # GitHub Pages (statik)
│   ├── index.html     # Ana sayfa + Three.js DNA helix
│   ├── login.html     # Giriş
│   ├── register.html  # Kayıt
│   ├── dashboard.html # Kullanıcı paneli
│   ├── admin.html     # Doktor paneli
│   ├── css/style.css  # Tema + stiller
│   └── js/            # Frontend JS modülleri
├── backend/           # Render.com (Node.js)
│   ├── src/
│   │   ├── index.js         # Express sunucu
│   │   ├── routes/          # API routes
│   │   ├── services/        # WhatsApp + AI servisleri
│   │   └── supabase/        # Veritabanı şeması
│   └── package.json
└── README.md
```

## Kurulum (7 Adımda Canlı)

### 1. Supabase Kurulumu (ücretsiz)
1. https://supabase.com → "Start a project"
2. Proje adı: `kivon-randevu`, şifre oluştur (kaydet!)
3. Region: Europe (Frankfurt)
4. Oluştuktan sonra SQL Editor'a gir:
   - `backend/supabase/schema.sql` içindeki tüm SQL'i yapıştır → "Run"
5. Project Settings → API:
   - `Project URL` → kopyala
   - `anon public key` → kopyala
   - `service_role key` → kopyala

### 2. OpenAI API
1. https://platform.openai.com/api-keys
2. "Create new secret key" → kopyala

### 3. WhatsApp Cloud API
1. https://developers.facebook.com → "My Apps" → "Create App"
2. "Business" seç → WhatsApp'a tıkla
3. "Get started" ile Business hesabı oluştur
4. WhatsApp → "API Setup" → Access Token al
5. "Phone numbers" → test numarası al
6. Webhook URL: `https://backend-adresin.onrender.com/api/whatsapp`
7. Verify token: `kivon_verify_2024`

### 4. Backend Deploy (Render - ücretsiz)
1. https://render.com → "New Web Service"
2. GitHub repo'nu bağla
3. Settings:
   - Root: `backend`
   - Build: `npm install`
   - Start: `node src/index.js`
4. Environment Variables (tüm `.env.example` daki değişkenleri gir)
5. Deploy → `https://kivon-randevu-backend.onrender.com` gibi bir URL al

### 5. Frontend Deploy (GitHub Pages)
```bash
cd frontend
# Ana dizine taşı veya subdomain yap
# GitHub Pages ayarlarından kivon-tr.github.io/kivon-randevu yap
```

### 6. Bağlantı
`frontend/js/api.js` içindeki `API_BASE_URL`'i Render URL'ine ayarla.

### 7. WhatsApp Webhook'u Güncelle
Render'daki URL'i WhatsApp Cloud API webhook'una gir:
`https://kivon-randevu-backend.onrender.com/api/whatsapp`

## API Endpoints

| Metot | Path | Açıklama |
|-------|------|----------|
| POST | /api/auth/signup | Kayıt ol |
| POST | /api/auth/login | Giriş yap |
| POST | /api/auth/logout | Çıkış |
| GET | /api/auth/me | Profil bilgisi |
| PUT | /api/auth/me | Profil güncelle |
| GET | /api/doctors | Doktor listesi |
| GET | /api/doctors/:id | Doktor detay |
| GET | /api/availability | Boş slotlar |
| POST | /api/availability/generate | Slot oluştur |
| GET | /api/appointments | Randevularım |
| POST | /api/appointments | Yeni randevu |
| PUT | /api/appointments/:id | Randevu güncelle |
| DELETE | /api/appointments/:id | İptal et |
| GET | /api/whatsapp | Webhook doğrulama |
| POST | /api/whatsapp | WhatsApp mesaj al |

## Veritabanı Tabloları

- `profiles` — Kullanıcı profilleri (auth.users extension)
- `doctors` — Doktor bilgileri, çalışma saatleri
- `availability` — Müsait slotlar (otomatik oluşturulur)
- `appointments` — Randevular
- `whatsapp_sessions` — WhatsApp konuşma durumları

## AI Asistan Akışı

1. Kullanıcı WhatsApp'a mesaj atar → Webhook yakalar
2. AI (OpenAI) mesajı yorumlar → Niyet analizi
3. Gerekirse takvimi sorgular (function calling)
4. Boş slotları kullanıcıya sunar
5. Kullanıcı seçer → AI randevuyu oluşturur
6. Onay mesajı + doktora bildirim gönderilir
