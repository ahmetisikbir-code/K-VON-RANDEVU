CREATE TABLE IF NOT EXISTS public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  whatsapp_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinics_owner ON public.clinics(owner_id);
CREATE INDEX IF NOT EXISTS idx_doctors_clinic ON public.doctors(clinic_id);

CREATE POLICY "Clinic owners read own"
  ON public.clinics FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Clinic owners insert"
  ON public.clinics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Clinic owners update own"
  ON public.clinics FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Clinic owners delete own"
  ON public.clinics FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Anyone can read doctors" ON public.doctors;
CREATE POLICY "Anyone can read doctors"
  ON public.doctors FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Doctors read own appointments" ON public.appointments;
CREATE POLICY "Clinic doctors read all"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    auth.uid() IN (
      SELECT profile_id FROM public.doctors WHERE id = doctor_id
    ) OR
    auth.uid() IN (
      SELECT d2.profile_id FROM public.doctors d2
      JOIN public.doctors d1 ON d1.clinic_id = d2.clinic_id
      WHERE d1.id = doctor_id
    )
  );

DROP POLICY IF EXISTS "Users update own appointments" ON public.appointments;
CREATE POLICY "Clinic doctors update all"
  ON public.appointments FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    auth.uid() IN (
      SELECT profile_id FROM public.doctors WHERE id = doctor_id
    ) OR
    auth.uid() IN (
      SELECT d2.profile_id FROM public.doctors d2
      JOIN public.doctors d1 ON d1.clinic_id = d2.clinic_id
      WHERE d1.id = doctor_id
    )
  )
  WITH CHECK (NEW.status IN ('cancelled', 'confirmed', 'completed'));

CREATE OR REPLACE FUNCTION public.handle_new_doctor_clinic()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clinic_id IS NULL THEN
    INSERT INTO public.clinics (owner_id, name, phone)
    VALUES (
      NEW.profile_id,
      (SELECT full_name FROM public.profiles WHERE id = NEW.profile_id),
      (SELECT phone FROM public.profiles WHERE id = NEW.profile_id)
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_doctor_created ON public.doctors;
CREATE TRIGGER on_doctor_created
  AFTER INSERT ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_doctor_clinic();
