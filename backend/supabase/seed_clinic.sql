INSERT INTO public.clinics (owner_id, name, phone)
VALUES (
  '9adb5eeb-77d5-4833-b2ca-ec31a2aab57c',
  'Furkan Barış Kliniği',
  '905303982712'
)
ON CONFLICT DO NOTHING;

UPDATE public.doctors
SET clinic_id = (SELECT id FROM public.clinics WHERE owner_id = '9adb5eeb-77d5-4833-b2ca-ec31a2aab57c' LIMIT 1)
WHERE profile_id = '9adb5eeb-77d5-4833-b2ca-ec31a2aab57c';
