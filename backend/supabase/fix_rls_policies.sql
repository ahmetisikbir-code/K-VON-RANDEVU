-- FIX: doctors tablosu RLS politikaları
-- SELECT: anon ve authenticated herkes okuyabilir (frontend anon key kullanıyor)
DROP POLICY IF EXISTS "Anyone can read doctors" ON public.doctors;
CREATE POLICY "Anyone can read doctors"
  ON public.doctors FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT: clinic owner veya aynı clinic'teki doctor ekleyebilir
DROP POLICY IF EXISTS "Clinic members can insert doctors" ON public.doctors;
CREATE POLICY "Clinic members can insert doctors"
  ON public.doctors FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.doctors WHERE profile_id = auth.uid()
    )
    OR
    auth.uid() IN (
      SELECT owner_id FROM public.clinics WHERE id = clinic_id
    )
  );

-- DELETE: sadece clinic owner silebilir
DROP POLICY IF EXISTS "Clinic owners can delete doctors" ON public.doctors;
CREATE POLICY "Clinic owners can delete doctors"
  ON public.doctors FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT owner_id FROM public.clinics WHERE id = clinic_id
    )
  );

-- UPDATE: mevcut policy zaten var (auth.uid() = profile_id)
