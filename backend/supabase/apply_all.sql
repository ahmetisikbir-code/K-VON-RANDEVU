-- =============================================
-- KIVON - TÜM DEĞİŞİKLİKLERİ UYGULA
-- service_role key ile Supabase SQL Editor'da çalıştır
-- =============================================

-- 1. ESKİ VERİLERİ TEMİZLE
DELETE FROM public.appointments;
DELETE FROM public.whatsapp_sessions;

-- Furkan'ın kişisel verilerini temizle
UPDATE public.profiles SET full_name = 'Demo Diş Hekimi 1', phone = '05303982712' WHERE id = '9adb5eeb-77d5-4833-b2ca-ec31a2aab57c';
UPDATE public.doctors SET whatsapp_number = '905303982712' WHERE profile_id = '9adb5eeb-77d5-4833-b2ca-ec31a2aab57c';

-- Dr. Ahmet Test'in verilerini temizle
UPDATE public.profiles SET full_name = 'Demo Diş Hekimi 2', phone = '05303982712' WHERE id = '24adeeed-0043-482a-b1b4-7f48be8b14f2';
UPDATE public.doctors SET whatsapp_number = '905303982712' WHERE profile_id = '24adeeed-0043-482a-b1b4-7f48be8b14f2';

-- 2. SEKTÖR ALANI EKLE
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS sector TEXT CHECK (sector IN ('dis_doktoru', 'kuaför', 'güzellik_salonu'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sector TEXT;

-- 3. TRIGGER GÜNCELLE
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

-- 4. MEVCUT KLİNİĞİ GÜNCELLE (id: acbc2f0b-2178-47d8-9695-14ec4b5b61e3)
UPDATE public.clinics SET name = 'Demo Diş Kliniği', phone = '905303982712', sector = 'dis_doktoru' WHERE id = 'acbc2f0b-2178-47d8-9695-14ec4b5b61e3';

-- 5. TÜM ESKİ RLS POLİTİKALARINI TEMİZLE
DO $$
DECLARE rec RECORD;
BEGIN
  FOR rec IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', rec.policyname, rec.schemaname, rec.tablename);
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- 6. PROFILES POLİTİKALARI
CREATE POLICY "profiles_select_public" ON public.profiles FOR SELECT TO anon USING (true);
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT (id, full_name, phone, avatar_url) ON public.profiles TO anon;

-- 7. CLINICS POLİTİKALARI
CREATE POLICY "clinics_select_all" ON public.clinics FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "clinics_insert_owner" ON public.clinics FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "clinics_update_owner" ON public.clinics FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "clinics_delete_owner" ON public.clinics FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- 8. DOCTORS POLİTİKALARI
CREATE POLICY "doctors_select_all" ON public.doctors FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "doctors_insert_clinic_member" ON public.doctors FOR INSERT TO authenticated WITH CHECK (
  clinic_id IN (SELECT clinic_id FROM public.doctors WHERE profile_id = auth.uid())
  OR auth.uid() IN (SELECT owner_id FROM public.clinics WHERE id = clinic_id)
);
CREATE POLICY "doctors_update_own_or_owner" ON public.doctors FOR UPDATE TO authenticated USING (
  auth.uid() = profile_id OR auth.uid() IN (SELECT owner_id FROM public.clinics WHERE id = clinic_id)
);
CREATE POLICY "doctors_delete_owner" ON public.doctors FOR DELETE TO authenticated USING (
  auth.uid() IN (SELECT owner_id FROM public.clinics WHERE id = clinic_id)
);

-- 9. APPOINTMENTS POLİTİKALARI
CREATE POLICY "appointments_select_own" ON public.appointments FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR auth.uid() IN (SELECT profile_id FROM public.doctors WHERE id = doctor_id)
);
CREATE POLICY "appointments_insert_own" ON public.appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "appointments_update_own" ON public.appointments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "appointments_delete_own_or_doctor" ON public.appointments FOR DELETE TO authenticated USING (
  auth.uid() = user_id
  OR auth.uid() IN (SELECT profile_id FROM public.doctors WHERE id = doctor_id)
  OR auth.uid() IN (SELECT c.owner_id FROM public.clinics c JOIN public.doctors d ON d.clinic_id = c.id WHERE d.id = doctor_id)
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 10. AVAILABILITY POLİTİKALARI
CREATE POLICY "availability_select_all" ON public.availability FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "availability_insert_doctor_or_owner" ON public.availability FOR INSERT TO authenticated WITH CHECK (
  doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid())
  OR doctor_id IN (SELECT d.id FROM public.doctors d JOIN public.clinics c ON d.clinic_id = c.id WHERE c.owner_id = auth.uid())
);
CREATE POLICY "availability_update_doctor_or_owner" ON public.availability FOR UPDATE TO authenticated USING (
  doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid())
  OR doctor_id IN (SELECT d.id FROM public.doctors d JOIN public.clinics c ON d.clinic_id = c.id WHERE c.owner_id = auth.uid())
);
CREATE POLICY "availability_delete_doctor_or_owner" ON public.availability FOR DELETE TO authenticated USING (
  doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid())
  OR doctor_id IN (SELECT d.id FROM public.doctors d JOIN public.clinics c ON d.clinic_id = c.id WHERE c.owner_id = auth.uid())
);

-- 11. WHATSAPP SESSIONS POLİTİKALARI
CREATE POLICY "whatsapp_sessions_select_own" ON public.whatsapp_sessions FOR SELECT TO authenticated USING (auth.uid() = profile_id);
CREATE POLICY "whatsapp_sessions_insert_own" ON public.whatsapp_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "whatsapp_sessions_update_own" ON public.whatsapp_sessions FOR UPDATE TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "whatsapp_sessions_delete_own" ON public.whatsapp_sessions FOR DELETE TO authenticated USING (auth.uid() = profile_id);

-- 12. AHMET'İN PROFİLİNİ GÜNCELLE
UPDATE public.profiles SET full_name = 'Ahmet Demir', sector = 'dis_doktoru' WHERE id = '6fc35211-3ef2-46f4-9884-da01ce98da31';

-- 13. DOKTORLARI DEMO KLİNİĞE BAĞLA (mevcut klinik ID: acbc2f0b-2178-47d8-9695-14ec4b5b61e3)
UPDATE public.doctors SET clinic_id = 'acbc2f0b-2178-47d8-9695-14ec4b5b61e3', specialty = 'Diş Hekimi' WHERE profile_id = '6fc35211-3ef2-46f4-9884-da01ce98da31';
UPDATE public.doctors SET clinic_id = 'acbc2f0b-2178-47d8-9695-14ec4b5b61e3', specialty = 'Diş Hekimi', whatsapp_number = '905303982712' WHERE profile_id = '9adb5eeb-77d5-4833-b2ca-ec31a2aab57c';
UPDATE public.doctors SET clinic_id = 'acbc2f0b-2178-47d8-9695-14ec4b5b61e3', specialty = 'Diş Hekimi', whatsapp_number = '905303982712' WHERE profile_id = '24adeeed-0043-482a-b1b4-7f48be8b14f2';
