-- ================================================================
-- ZED - Supabase Schema v3 (migration-safe)
-- Run in Supabase SQL Editor
-- ================================================================

-- -------------------------------
-- EXTENSIONS
-- -------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- -------------------------------
-- SHARED FUNCTIONS
-- -------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.raw_user_meta_data->>'full_name', ' ', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name',  split_part(NEW.raw_user_meta_data->>'full_name', ' ', 2))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.bump_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_sessions SET updated_at = NOW() WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 1) PROFILES
-- ================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name       TEXT,
  last_name        TEXT,
  date_of_birth    DATE,
  age              INTEGER,
  gender           TEXT,
  blood_group      TEXT,
  height           NUMERIC(5,1),
  weight           NUMERIC(5,1),
  allergies        TEXT,
  conditions       TEXT,
  medications      TEXT,
  past_surgeries   TEXT,
  family_history   TEXT,
  smoking          TEXT,
  alcohol          TEXT,
  exercise         TEXT,
  diet             TEXT,
  ec_name          TEXT,
  ec_phone         TEXT,
  ec_relationship  TEXT,
  avatar_path      TEXT,
  onboarded        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_updated_idx ON public.profiles(updated_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_self" ON public.profiles;
CREATE POLICY "profiles_self"
  ON public.profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- 2) CHAT SESSIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'New Consultation',
  model       TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_idx ON public.chat_sessions(user_id, updated_at DESC);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_sessions_self" ON public.chat_sessions;
CREATE POLICY "chat_sessions_self"
  ON public.chat_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS chat_sessions_updated_at ON public.chat_sessions;
CREATE TRIGGER chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================================================================
-- 3) CHAT MESSAGES
-- ================================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content     TEXT NOT NULL,
  tokens      INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON public.chat_messages(session_id, created_at ASC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_messages_self" ON public.chat_messages;
CREATE POLICY "chat_messages_self"
  ON public.chat_messages FOR ALL
  USING (
    auth.uid() = (
      SELECT user_id FROM public.chat_sessions WHERE id = session_id LIMIT 1
    )
  );

DROP TRIGGER IF EXISTS chat_messages_bump_session ON public.chat_messages;
CREATE TRIGGER chat_messages_bump_session
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_session_updated_at();

-- ================================================================
-- 4) SYMPTOM CHECKS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.symptom_checks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area        TEXT,
  symptoms    TEXT[],
  severity    INTEGER CHECK (severity BETWEEN 1 AND 10),
  duration    TEXT,
  modifiers   TEXT,
  result      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS symptom_checks_user_idx ON public.symptom_checks(user_id, created_at DESC);

ALTER TABLE public.symptom_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "symptom_checks_self" ON public.symptom_checks;
CREATE POLICY "symptom_checks_self"
  ON public.symptom_checks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- 5) MEDICAL REPORTS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.medical_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name       TEXT,
  file_type       TEXT,
  storage_path    TEXT,
  analysis_type   TEXT,
  result          TEXT,
  notes           TEXT,
  analyzed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS medical_reports_user_idx ON public.medical_reports(user_id, analyzed_at DESC);

ALTER TABLE public.medical_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "medical_reports_self" ON public.medical_reports;
CREATE POLICY "medical_reports_self"
  ON public.medical_reports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- 6) HEALTH TIPS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.health_tips (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  tips          JSONB NOT NULL DEFAULT '[]',
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS health_tips_user_idx ON public.health_tips(user_id, generated_at DESC);

ALTER TABLE public.health_tips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "health_tips_self" ON public.health_tips;
CREATE POLICY "health_tips_self"
  ON public.health_tips FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- 7) APPOINTMENTS (legacy-safe)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_name     TEXT,
  specialty       TEXT,
  location        TEXT,
  appointment_date TIMESTAMPTZ,
  duration_mins   INTEGER DEFAULT 30,
  notes           TEXT,
  status          TEXT DEFAULT 'confirmed',
  reminder_sent   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure old tables get new columns
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS doctor_name TEXT,
  ADD COLUMN IF NOT EXISTS specialty TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_mins INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Optional backfill from legacy column names if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='appointments' AND column_name='appointment_at'
  ) THEN
    EXECUTE $q$
      UPDATE public.appointments
      SET appointment_date = appointment_at
      WHERE appointment_date IS NULL AND appointment_at IS NOT NULL
    $q$;
  END IF;
END $$;

-- Make appointment_date required once backfill is done
ALTER TABLE public.appointments
  ALTER COLUMN appointment_date SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_status_check'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_status_check
      CHECK (status IN ('confirmed','pending','cancelled','completed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS appointments_user_idx
  ON public.appointments(user_id, appointment_date ASC);

CREATE INDEX IF NOT EXISTS appointments_upcoming_idx
  ON public.appointments(appointment_date ASC)
  WHERE status IN ('confirmed','pending');

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "appointments_self" ON public.appointments;
CREATE POLICY "appointments_self"
  ON public.appointments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS appointments_updated_at ON public.appointments;
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================================================================
-- 8) VITALS LOG
-- ================================================================
CREATE TABLE IF NOT EXISTS public.vitals_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  heart_rate      INTEGER,
  bp_systolic     INTEGER,
  bp_diastolic    INTEGER,
  temperature     NUMERIC(4,1),
  spo2            INTEGER,
  weight          NUMERIC(5,1),
  blood_glucose   NUMERIC(5,1),
  notes           TEXT,
  source          TEXT DEFAULT 'manual'
);

CREATE INDEX IF NOT EXISTS vitals_log_user_idx ON public.vitals_log(user_id, recorded_at DESC);

ALTER TABLE public.vitals_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vitals_log_self" ON public.vitals_log;
CREATE POLICY "vitals_log_self"
  ON public.vitals_log FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- 9) NOTIFICATIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'info'
                CHECK (type IN ('info','success','warn','error','reminder')),
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications(user_id, created_at DESC)
  WHERE read = FALSE;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_self" ON public.notifications;
CREATE POLICY "notifications_self"
  ON public.notifications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- 10) MEDICINE SCANS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.medicine_scans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  drug_name   TEXT,
  verdict     TEXT CHECK (verdict IN ('authentic','caution','suspect','unverifiable')),
  score       INTEGER,
  result      JSONB,
  scanned_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS medicine_scans_user_idx ON public.medicine_scans(user_id, scanned_at DESC);

ALTER TABLE public.medicine_scans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own scans" ON public.medicine_scans;
CREATE POLICY "Users manage own scans"
  ON public.medicine_scans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- 11) ACTIVITY LOGS (for admin dashboard)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.zed_activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  event_type  TEXT NOT NULL,
  event_label TEXT NOT NULL,
  page        TEXT,
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS zed_activity_logs_user_idx ON public.zed_activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS zed_activity_logs_type_idx ON public.zed_activity_logs(event_type, created_at DESC);

ALTER TABLE public.zed_activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users insert own activity logs" ON public.zed_activity_logs;
CREATE POLICY "Users insert own activity logs"
  ON public.zed_activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own activity logs" ON public.zed_activity_logs;
CREATE POLICY "Users read own activity logs"
  ON public.zed_activity_logs FOR SELECT
  USING (auth.uid() = user_id);

-- ================================================================
-- VIEWS
-- ================================================================
CREATE OR REPLACE VIEW public.latest_vitals AS
SELECT DISTINCT ON (user_id)
  user_id, heart_rate, bp_systolic, bp_diastolic,
  temperature, spo2, weight, blood_glucose, recorded_at
FROM public.vitals_log
ORDER BY user_id, recorded_at DESC;

CREATE OR REPLACE VIEW public.unread_notification_count AS
SELECT user_id, COUNT(*) AS unread_count
FROM public.notifications
WHERE read = FALSE
GROUP BY user_id;

CREATE OR REPLACE VIEW public.upcoming_appointments AS
SELECT *
FROM public.appointments
WHERE appointment_date > NOW()
  AND status IN ('confirmed', 'pending')
ORDER BY appointment_date ASC;
