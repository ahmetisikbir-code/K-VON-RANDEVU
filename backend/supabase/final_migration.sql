-- =============================================
-- KIVON Multi-Sektör Randevu Sistemi
-- Final Migration
-- service_role key ile Supabase SQL Editor'da çalıştır
-- =============================================

-- =============================================
-- 1. MEVCUT ŞEMAYA ALAN EKLEMELERİ
-- =============================================

ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS sector TEXT CHECK (sector IN ('dis_doktoru', 'kuaför', 'güzellik_salonu'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sector TEXT;

-- =============================================
-- 2. TRIGGER GÜNCELLEME (sector alanı için)
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, phone, sector)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'sector', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 3. TÜM RLS POLİTİKALARINI TEMİZLE
-- =============================================

DROP POLICY IF EXISTS "Anyone can read doctors" ON public.doctors;
DROP POLICY IF EXISTS "Clinic members can insert doctors" ON public.doctors;
DROP POLICY IF EXISTS "Clinic owners can delete doctors" ON public.doctors;
DROP POLICY IF EXISTS "Doctors can update own" ON public.doctors;

DROP POLICY IF EXISTS "Clinic owners read own" ON public.clinics;
DROP POLICY IF EXISTS "Clinic owners insert" ON public.clinics;
DROP POLICY IF EXISTS "Clinic owners update own" ON public.clinics;
DROP POLICY IF EXISTS "Clinic owners delete own" ON public.clinics;

DROP POLICY IF EXISTS "Users read own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Doctors read own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users update own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Clinic doctors read all" ON public.appointments;
DROP POLICY IF EXISTS "Clinic doctors update all" ON public.appointments;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- =============================================
-- 4. RLS POLİTİKALARINI YENİDEN OLUŞTUR
-- =============================================

-- --- DOCTORS ---
-- SELECT: anon ve authenticated herkes görebilir
CREATE POLICY "anyone can view doctors"
  ON public.doctors FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT: aynı klinikteki doktorlar veya klinik sahibi ekleyebilir
CREATE POLICY "clinic members can insert doctors"
  ON public.doctors FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM public.doctors WHERE profile_id = auth.uid())
    OR
    auth.uid() IN (SELECT owner_id FROM public.clinics WHERE id = clinic_id)
  );

-- UPDATE: doktor kendi kaydını güncelleyebilir
CREATE POLICY "doctors can update own"
  ON public.doctors FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id);

-- DELETE: sadece klinik sahibi silebilir
CREATE POLICY "clinic owners can delete doctors"
  ON public.doctors FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (SELECT owner_id FROM public.clinics WHERE id = clinic_id)
  );

-- --- CLINICS ---
-- SELECT: anon ve authenticated herkes görebilir
CREATE POLICY "anyone can view clinics"
  ON public.clinics FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT: authenticated kullanıcı kendi kliniğini oluşturabilir
CREATE POLICY "users can insert clinics"
  ON public.clinics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- UPDATE: sadece klinik sahibi güncelleyebilir
CREATE POLICY "owners can update clinics"
  ON public.clinics FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id);

-- DELETE: sadece klinik sahibi silebilir
CREATE POLICY "owners can delete clinics"
  ON public.clinics FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- --- APPOINTMENTS ---
-- SELECT: kullanıcı kendi randevularını görebilir
CREATE POLICY "users view own appointments"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT: authenticated kullanıcı kendi adına randevu alabilir
CREATE POLICY "users create own appointments"
  ON public.appointments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: kullanıcı kendi randevusunu güncelleyebilir
CREATE POLICY "users update own appointments"
  ON public.appointments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (status IN ('pending', 'cancelled'));

-- DELETE: kullanıcı kendi randevusunu silebilir
CREATE POLICY "users delete own appointments"
  ON public.appointments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- --- PROFILES ---
-- SELECT (anon): temel bilgileri herkes görebilir
CREATE POLICY "anon can view profiles"
  ON public.profiles FOR SELECT
  TO anon
  USING (true);

-- SELECT (authenticated): kullanıcı kendi profilini görebilir
CREATE POLICY "users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- UPDATE: kullanıcı kendi profilini güncelleyebilir
CREATE POLICY "users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- =============================================
-- 5. DEMO VERİ
-- =============================================

-- Ahmet'in profilini güncelle
UPDATE public.profiles
SET full_name = 'Ahmet Demir',
    sector = 'dis_doktoru'
WHERE id = '6fc35211-3ef2-46f4-9884-da01ce98da31';

-- Demo klinik oluştur (eğer yoksa)
INSERT INTO public.clinics (id, owner_id, name, phone, sector)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '6fc35211-3ef2-46f4-9884-da01ce98da31',
  'Demo Diş Kliniği',
  '905303982712',
  'dis_doktoru'
)
ON CONFLICT (id) DO NOTHING;

-- Demo doktor 1: Dr. Ahmet Demir (mevcut auth user)
INSERT INTO public.doctors (profile_id, clinic_id, specialty)
VALUES (
  '6fc35211-3ef2-46f4-9884-da01ce98da31',
  'a0000000-0000-0000-0000-000000000001',
  'Diş Hekimi'
)
ON CONFLICT (profile_id) DO UPDATE SET
  clinic_id = EXCLUDED.clinic_id,
  specialty = EXCLUDED.specialty;

-- Demo doktor 2: Dr. Elif Yılmaz
-- NOT: Yeni auth user bu SQL ile oluşturulamaz çünkü auth.users tablosuna
-- doğrudan INSERT yapılamaz (Supabase auth schema). Profile kaydı da
-- trigger ile otomatik gelir.
-- Admin panelden manuel ekleme adımları:
--   1. Supabase Authentication > Add User ile 'elif@ornek.com' ekle
--      (şifre: geçici bir şifre, sonra değiştirsin)
--   2. Profile otomatik oluşacak, full_name'ini 'Dr. Elif Yılmaz' yap
--   3. Sector'ünü 'dis_doktoru' yap
--   4. doctors tablosuna şu şekilde ekle:
--      INSERT INTO public.doctors (profile_id, clinic_id, specialty)
--      VALUES (
--        (SELECT id FROM public.profiles WHERE full_name = 'Dr. Elif Yılmaz' LIMIT 1),
--        'a0000000-0000-0000-0000-000000000001',
--        'Diş Hekimi'
--      );
