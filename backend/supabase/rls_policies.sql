-- ============================================================
-- KIVON Randevu Sistemi — Tüm RLS Politikaları
-- Supabase SQL Editor'da çalıştırınız.
-- ============================================================

-- Mevcut tüm politikaları temizle
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('profiles','clinics','doctors','appointments','availability','whatsapp_sessions')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', rec.policyname, rec.schemaname, rec.tablename);
    END LOOP;
END $$;

-- RLS aktif olduğundan emin ol
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- ============================================================

-- SELECT: kullanıcı kendi profilini görebilir
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

-- SELECT: anon kullanıcılar sadece public profil alanlarını görebilir
CREATE POLICY "profiles_select_public" ON public.profiles
    FOR SELECT TO anon
    USING (true);

-- INSERT: manuel ekleme kapalı — sadece handle_new_user() trigger'ı ekler (SECURITY DEFINER)

-- UPDATE: kullanıcı kendi profilini güncelleyebilir
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- service_role tüm işlemleri yapabilir (admin işlemleri için)
CREATE POLICY "profiles_admin_all" ON public.profiles
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- anon için kolon bazlı yetkilendirme
GRANT SELECT (id, full_name, phone, avatar_url) ON public.profiles TO anon;

-- ============================================================
-- CLINICS
-- ============================================================

-- SELECT: herkes görebilir (anon + authenticated)
CREATE POLICY "clinics_select_all" ON public.clinics
    FOR SELECT TO anon, authenticated
    USING (true);

-- INSERT: authenticated kullanıcı, klinik sahibi olarak kaydeder
CREATE POLICY "clinics_insert_owner" ON public.clinics
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = owner_id);

-- UPDATE: sadece klinik sahibi güncelleyebilir
CREATE POLICY "clinics_update_owner" ON public.clinics
    FOR UPDATE TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- DELETE: sadece klinik sahibi silebilir
CREATE POLICY "clinics_delete_owner" ON public.clinics
    FOR DELETE TO authenticated
    USING (auth.uid() = owner_id);

-- ============================================================
-- DOCTORS
-- ============================================================

-- SELECT: herkes görebilir (anon + authenticated)
CREATE POLICY "doctors_select_all" ON public.doctors
    FOR SELECT TO anon, authenticated
    USING (true);

-- INSERT: aynı klinikte doktor olan veya klinik sahibi ekleyebilir
CREATE POLICY "doctors_insert_clinic_member" ON public.doctors
    FOR INSERT TO authenticated
    WITH CHECK (
        clinic_id IN (SELECT clinic_id FROM public.doctors WHERE profile_id = auth.uid())
        OR
        auth.uid() IN (SELECT owner_id FROM public.clinics WHERE id = clinic_id)
    );

-- UPDATE: doktor kendisi veya klinik sahibi güncelleyebilir
CREATE POLICY "doctors_update_own_or_owner" ON public.doctors
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = profile_id
        OR
        auth.uid() IN (SELECT owner_id FROM public.clinics WHERE id = clinic_id)
    );

-- DELETE: sadece klinik sahibi silebilir
CREATE POLICY "doctors_delete_owner" ON public.doctors
    FOR DELETE TO authenticated
    USING (
        auth.uid() IN (SELECT owner_id FROM public.clinics WHERE id = clinic_id)
    );

-- ============================================================
-- APPOINTMENTS
-- ============================================================

-- SELECT: kendi randevusu veya doktor kendi randevularını görebilir
CREATE POLICY "appointments_select_own" ON public.appointments
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id
        OR
        auth.uid() IN (SELECT profile_id FROM public.doctors WHERE id = doctor_id)
    );

-- INSERT: authenticated kullanıcı kendi randevusunu oluşturabilir
CREATE POLICY "appointments_insert_own" ON public.appointments
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: kullanıcı kendi randevusunu güncelleyebilir
CREATE POLICY "appointments_update_own" ON public.appointments
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- DELETE: kendi randevusu, ilgili doktor, klinik sahibi veya admin silebilir
CREATE POLICY "appointments_delete_own_or_doctor" ON public.appointments
    FOR DELETE TO authenticated
    USING (
        auth.uid() = user_id
        OR
        auth.uid() IN (SELECT profile_id FROM public.doctors WHERE id = doctor_id)
        OR
        auth.uid() IN (
            SELECT c.owner_id FROM public.clinics c
            JOIN public.doctors d ON d.clinic_id = c.id
            WHERE d.id = doctor_id
        )
        OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================================
-- AVAILABILITY
-- ============================================================

-- SELECT: herkes görebilir (anon + authenticated)
CREATE POLICY "availability_select_all" ON public.availability
    FOR SELECT TO anon, authenticated
    USING (true);

-- INSERT: sadece doktor kendisi veya klinik sahibi
CREATE POLICY "availability_insert_doctor_or_owner" ON public.availability
    FOR INSERT TO authenticated
    WITH CHECK (
        doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid())
        OR
        doctor_id IN (
            SELECT d.id FROM public.doctors d
            JOIN public.clinics c ON d.clinic_id = c.id
            WHERE c.owner_id = auth.uid()
        )
    );

-- UPDATE: sadece doktor kendisi veya klinik sahibi
CREATE POLICY "availability_update_doctor_or_owner" ON public.availability
    FOR UPDATE TO authenticated
    USING (
        doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid())
        OR
        doctor_id IN (
            SELECT d.id FROM public.doctors d
            JOIN public.clinics c ON d.clinic_id = c.id
            WHERE c.owner_id = auth.uid()
        )
    );

-- DELETE: sadece doktor kendisi veya klinik sahibi
CREATE POLICY "availability_delete_doctor_or_owner" ON public.availability
    FOR DELETE TO authenticated
    USING (
        doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid())
        OR
        doctor_id IN (
            SELECT d.id FROM public.doctors d
            JOIN public.clinics c ON d.clinic_id = c.id
            WHERE c.owner_id = auth.uid()
        )
    );

-- ============================================================
-- WHATSAPP SESSIONS
-- ============================================================

-- SELECT: kendi session'ını görebilir
CREATE POLICY "whatsapp_sessions_select_own" ON public.whatsapp_sessions
    FOR SELECT TO authenticated
    USING (auth.uid() = profile_id);

-- INSERT: kendi session'ını oluşturabilir
CREATE POLICY "whatsapp_sessions_insert_own" ON public.whatsapp_sessions
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = profile_id);

-- UPDATE: kendi session'ını güncelleyebilir
CREATE POLICY "whatsapp_sessions_update_own" ON public.whatsapp_sessions
    FOR UPDATE TO authenticated
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

-- DELETE: kendi session'ını silebilir
CREATE POLICY "whatsapp_sessions_delete_own" ON public.whatsapp_sessions
    FOR DELETE TO authenticated
    USING (auth.uid() = profile_id);
