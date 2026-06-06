# Test Raporu

| Test | Durum | Detay |
|------|-------|-------|
| TEST 1: Anon ile doctors SELECT (en az 2 doktor) | ✅ PASS |  |
| TEST 2: Anon ile clinics SELECT (en az 1 klinik) | ❌ FAIL | Hata: Beklenen: en az 1 klinik, bulunan: 0 |
| TEST 3: Service role ile INSERT doctors | ❌ FAIL | Hata: null value in column "profile_id" of relation "doctors" violates not-null constraint - Failing row contains (0fa1f8ad-22bf-4f2b-a71e-5ecc6c9cf13c, null, test-specialty, , {1,2,3,4,5}, 30, 12:00:00, 13:00:00, 2026-06-06 01:57:25.521189+00, null, null, {}, null, null, acbc2f0b-2178-47d8-9695-14ec4b5b61e3). |
| TEST 4: Bot sorgusu (whatsapp not null) - en az 1 doktor | ✅ PASS |  |
| TEST 5: Randevu sayisi kontrol | ❌ FAIL | Hata: 50+ randevu (64 adet) - temizleme önerilir |

*Rapor tarihi: 2026-06-06T01:57:27.469Z*