-- KIVON Randevu Sistemi - Supabase Schema
-- Çalıştır: Supabase SQL Editor'a yapıştır

-- 1. PROFILES (auth.users extension)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','doctor','admin')),
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. DOCTORS (only if role=doctor)
CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  specialty TEXT NOT NULL DEFAULT '',
  bio TEXT DEFAULT '',
  working_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5],
  slot_duration INTEGER DEFAULT 30,
  break_start TIME DEFAULT '12:00',
  break_end TIME DEFAULT '13:00',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

-- 3. AVAILABILITY (generated slots)
CREATE TABLE public.availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_booked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(doctor_id, date, start_time)
);
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

-- 4. APPOINTMENTS
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  slot_id UUID REFERENCES public.availability(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  notes TEXT DEFAULT '',
  whatsapp_chat_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- 5. WHATSAPP SESSIONS
CREATE TABLE public.whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  conversation_state TEXT DEFAULT 'idle',
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- INDEXES
CREATE INDEX idx_appointments_user ON public.appointments(user_id);
CREATE INDEX idx_appointments_doctor ON public.appointments(doctor_id);
CREATE INDEX idx_appointments_date ON public.appointments(date);
CREATE INDEX idx_availability_doctor_date ON public.availability(doctor_id, date);
CREATE INDEX idx_whatsapp_phone ON public.whatsapp_sessions(phone_number);

-- RLS POLICIES
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Anyone can read doctors"
  ON public.doctors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Doctors can update own"
  ON public.doctors FOR UPDATE
  USING (auth.uid() = profile_id);

CREATE POLICY "Users read availability"
  ON public.availability FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users read own appointments"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Doctors read own appointments"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (auth.uid() IN (
    SELECT profile_id FROM public.doctors WHERE id = doctor_id
  ));

CREATE POLICY "Users create appointments"
  ON public.appointments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own appointments"
  ON public.appointments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (NEW.status IN ('cancelled'));

CREATE POLICY "WhatsApp sessions upsert"
  ON public.whatsapp_sessions FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- GENERATE AVAILABILITY FUNCTION
CREATE OR REPLACE FUNCTION public.generate_availability(
  p_doctor_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS SETOF public.availability AS $$
DECLARE
  v_doctor RECORD;
  v_date DATE;
  v_time TIME;
  v_end_time TIME;
BEGIN
  SELECT * INTO v_doctor FROM public.doctors WHERE id = p_doctor_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_date := p_start_date;
  WHILE v_date <= p_end_date LOOP
    IF EXTRACT(DOW FROM v_date) = ANY(v_doctor.working_days) THEN
      v_time := '09:00'::TIME;
      WHILE v_time < '17:00'::TIME LOOP
        IF v_time < v_doctor.break_start OR v_time >= v_doctor.break_end THEN
          v_end_time := v_time + (v_doctor.slot_duration || ' minutes')::INTERVAL;
          IF v_end_time <= '17:00'::TIME THEN
            INSERT INTO public.availability (doctor_id, date, start_time, end_time)
            VALUES (p_doctor_id, v_date, v_time, v_end_time)
            ON CONFLICT (doctor_id, date, start_time) DO NOTHING;
          END IF;
        END IF;
        v_time := v_time + (v_doctor.slot_duration || ' minutes')::INTERVAL;
      END LOOP;
    END IF;
    v_date := v_date + 1;
  END LOOP;
  RETURN QUERY SELECT * FROM public.availability
    WHERE doctor_id = p_doctor_id
    AND date >= p_start_date AND date <= p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
