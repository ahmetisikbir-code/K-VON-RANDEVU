CREATE OR REPLACE FUNCTION public.handle_new_doctor_clinic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

DROP TRIGGER IF EXISTS on_doctor_created ON public.doctors;
CREATE TRIGGER on_doctor_created
  AFTER INSERT ON public.doctors
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_doctor_clinic();
