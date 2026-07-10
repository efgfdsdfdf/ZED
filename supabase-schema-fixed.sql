-- ================================================================
-- ZED - Supabase Schema v3 FIXED (appointment_date instead of appointment_at)
-- Run this in Supabase SQL Editor to fix column error
-- ================================================================

-- Drop problematic migration parts first
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
DROP INDEX IF EXISTS public.appointments_user_idx;
DROP INDEX IF EXISTS public.appointments_upcoming_idx;
DROP TRIGGER IF EXISTS appointments_updated_at ON public.appointments;

-- Ensure appointment_date exists (rename if needed)
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMPTZ;

-- Backfill from legacy columns before dropping old names
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='appointments' AND column_name='appointment_at'
  ) THEN
    UPDATE public.appointments
    SET appointment_date = appointment_at
    WHERE appointment_date IS NULL AND appointment_at IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='appointments' AND column_name='appointment_time'
  ) THEN
    UPDATE public.appointments
    SET appointment_date = appointment_time
    WHERE appointment_date IS NULL AND appointment_time IS NOT NULL;
  END IF;
END $$;

ALTER TABLE public.appointments DROP COLUMN IF EXISTS appointment_at;

-- Add other missing columns safely
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS doctor_name TEXT,
  ADD COLUMN IF NOT EXISTS specialty TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS duration_mins INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Status constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_status_check'
      AND conrelid = 'public.appointments'::regclass
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_status_check
      CHECK (status IN ('confirmed','pending','cancelled','completed'));
  END IF;
END $$;

-- Indexes on appointment_date
CREATE INDEX IF NOT EXISTS appointments_user_date_idx ON public.appointments(user_id, appointment_date ASC);
CREATE INDEX IF NOT EXISTS appointments_upcoming_date_idx ON public.appointments(appointment_date ASC)
  WHERE status IN ('confirmed','pending');

-- RLS and trigger
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

-- Fix views
DROP VIEW IF EXISTS public.upcoming_appointments;
CREATE OR REPLACE VIEW public.upcoming_appointments AS
SELECT *
FROM public.appointments
WHERE appointment_date > NOW()
  AND status IN ('confirmed', 'pending')
ORDER BY appointment_date ASC;

-- Verify: SELECT column_name FROM information_schema.columns WHERE table_name='appointments' ORDER BY ordinal_position;
-- Should show appointment_date, no appointment_at
