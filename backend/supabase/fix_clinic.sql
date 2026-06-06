UPDATE public.doctors SET clinic_id = 'acbc2f0b-2178-47d8-9695-14ec4b5b61e3' WHERE clinic_id IS NULL AND profile_id IN (SELECT id FROM public.profiles WHERE role = 'doctor');
