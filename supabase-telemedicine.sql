-- ================================================================
-- ZED Telemedicine Module Schema (Marketplace)
-- Safe to re-run
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------
-- Doctors
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctors (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name             TEXT NOT NULL,
  email                 TEXT NOT NULL,
  specialty             TEXT NOT NULL,
  license_number        TEXT NOT NULL UNIQUE,
  price_per_session     NUMERIC(12,2) NOT NULL CHECK (price_per_session > 0),
  bio                   TEXT NOT NULL,
  availability          JSONB NOT NULL DEFAULT '{}'::jsonb,
  license_document_url  TEXT,
  verified              BOOLEAN NOT NULL DEFAULT FALSE,
  rating                NUMERIC(3,2),
  rating_count          INTEGER NOT NULL DEFAULT 0,
  score_points          INTEGER NOT NULL DEFAULT 0,
  total_bookings        INTEGER NOT NULL DEFAULT 0,
  total_earnings        NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration-safe patch for existing older doctors table
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS specialty TEXT,
  ADD COLUMN IF NOT EXISTS license_number TEXT,
  ADD COLUMN IF NOT EXISTS price_per_session NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS availability JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS license_document_url TEXT,
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_bookings INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earnings NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS doctors_verified_idx ON public.doctors(verified, specialty);
CREATE INDEX IF NOT EXISTS doctors_created_idx ON public.doctors(created_at DESC);
CREATE INDEX IF NOT EXISTS doctors_rank_idx ON public.doctors(verified, score_points DESC, rating DESC, created_at DESC);

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Doctors read verified profiles" ON public.doctors;
CREATE POLICY "Doctors read verified profiles"
  ON public.doctors FOR SELECT
  USING (verified = TRUE OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Doctors self manage profile" ON public.doctors;
CREATE POLICY "Doctors self manage profile"
  ON public.doctors FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------
-- Bookings
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id        UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  scheduled_time   TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','active','completed')),
  amount           NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  platform_fee     NUMERIC(12,2) NOT NULL CHECK (platform_fee >= 0),
  doctor_earnings  NUMERIC(12,2) NOT NULL CHECK (doctor_earnings >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration-safe patch for existing older bookings table
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS doctor_id UUID,
  ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS doctor_earnings NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS bookings_patient_idx ON public.bookings(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_doctor_idx ON public.bookings(doctor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_scheduled_idx ON public.bookings(scheduled_time ASC);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Bookings patient or doctor access" ON public.bookings;
CREATE POLICY "Bookings patient or doctor access"
  ON public.bookings FOR ALL
  USING (
    auth.uid() = patient_id
    OR auth.uid() = (SELECT user_id FROM public.doctors d WHERE d.id = doctor_id LIMIT 1)
  )
  WITH CHECK (
    auth.uid() = patient_id
    OR auth.uid() = (SELECT user_id FROM public.doctors d WHERE d.id = doctor_id LIMIT 1)
  );

-- ------------------------------------------------
-- Messages (Consultation Chat)
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration-safe patch for existing older messages table
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS booking_id UUID,
  ADD COLUMN IF NOT EXISTS sender_id UUID,
  ADD COLUMN IF NOT EXISTS receiver_id UUID,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS messages_booking_idx ON public.messages(booking_id, created_at ASC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Messages booking participants" ON public.messages;
CREATE POLICY "Messages booking participants"
  ON public.messages FOR ALL
  USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
    OR auth.uid() = (
      SELECT b.patient_id FROM public.bookings b WHERE b.id = booking_id LIMIT 1
    )
    OR auth.uid() = (
      SELECT d.user_id
      FROM public.bookings b
      JOIN public.doctors d ON d.id = b.doctor_id
      WHERE b.id = booking_id
      LIMIT 1
    )
  )
  WITH CHECK (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
  );

-- ------------------------------------------------
-- Payments
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  total_amount     NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  platform_cut     NUMERIC(12,2) NOT NULL CHECK (platform_cut >= 0),
  doctor_cut       NUMERIC(12,2) NOT NULL CHECK (doctor_cut >= 0),
  status           TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','success','failed')),
  gateway_reference TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration-safe patch for existing older payments table
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS booking_id UUID,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_cut NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS doctor_cut NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS gateway_reference TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS payments_created_idx ON public.payments(created_at DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Payments booking participants read" ON public.payments;
CREATE POLICY "Payments booking participants read"
  ON public.payments FOR SELECT
  USING (
    auth.uid() = (
      SELECT b.patient_id FROM public.bookings b WHERE b.id = booking_id LIMIT 1
    )
    OR auth.uid() = (
      SELECT d.user_id
      FROM public.bookings b
      JOIN public.doctors d ON d.id = b.doctor_id
      WHERE b.id = booking_id
      LIMIT 1
    )
  );

-- ------------------------------------------------
-- Doctor Reviews (for ranking)
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctor_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  patient_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id  UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration-safe patch for existing older doctor_reviews table
ALTER TABLE public.doctor_reviews
  ADD COLUMN IF NOT EXISTS doctor_id UUID,
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS booking_id UUID,
  ADD COLUMN IF NOT EXISTS rating INTEGER,
  ADD COLUMN IF NOT EXISTS comment TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS doctor_reviews_doctor_idx ON public.doctor_reviews(doctor_id, created_at DESC);

ALTER TABLE public.doctor_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reviews readable by participants" ON public.doctor_reviews;
CREATE POLICY "Reviews readable by participants"
  ON public.doctor_reviews FOR SELECT
  USING (
    auth.uid() = patient_id
    OR auth.uid() = (SELECT user_id FROM public.doctors d WHERE d.id = doctor_id LIMIT 1)
  );

DROP POLICY IF EXISTS "Patients create own reviews" ON public.doctor_reviews;
CREATE POLICY "Patients create own reviews"
  ON public.doctor_reviews FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

-- ------------------------------------------------
-- Admin helper functions
-- ------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_doctor(p_doctor_id UUID)
RETURNS public.doctors
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE updated_row public.doctors;
BEGIN
  UPDATE public.doctors
  SET verified = TRUE
  WHERE id = p_doctor_id
  RETURNING * INTO updated_row;

  RETURN updated_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_doctor(p_doctor_id UUID)
RETURNS public.doctors
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE updated_row public.doctors;
BEGIN
  UPDATE public.doctors
  SET verified = FALSE
  WHERE id = p_doctor_id
  RETURNING * INTO updated_row;

  RETURN updated_row;
END;
$$;
