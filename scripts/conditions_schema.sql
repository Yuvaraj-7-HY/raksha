-- ============================================================================
-- Raksha: Condition-Aware Care Platform Schema (Part 1)
-- Supports: Diabetes, Hypertension, Dementia, Depression
-- Run once in Supabase SQL Editor (service-role context).
-- ============================================================================

-- ── 1. patient_conditions ────────────────────────────────────────────────────
-- Conditions are tags attached to patients. Switches on specific modules.
CREATE TABLE IF NOT EXISTS patient_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('diabetes', 'hypertension', 'dementia', 'depression')),
  diagnosed_on DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, condition_type)
);

CREATE INDEX IF NOT EXISTS idx_patient_conditions_active 
  ON patient_conditions(patient_id, is_active);

-- ── 2. readings (generic vitals / metrics store) ──────────────────────────────
CREATE TABLE IF NOT EXISTS readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('diabetes', 'hypertension', 'dementia', 'depression')),
  reading_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  note TEXT,
  source TEXT NOT NULL CHECK (source IN ('patient', 'caregiver', 'call', 'clinician')),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index required by spec: (patient_id, reading_type, recorded_at desc)
CREATE INDEX IF NOT EXISTS idx_readings_patient_type_recorded 
  ON readings(patient_id, reading_type, recorded_at DESC);

-- ── 3. care_plans (per-patient thresholds, clinician editable) ───────────────
CREATE TABLE IF NOT EXISTS care_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('diabetes', 'hypertension', 'dementia', 'depression')),
  thresholds JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT NOT NULL DEFAULT 'care_team',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, condition_type)
);

-- ── 4. condition_alerts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS condition_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('diabetes', 'hypertension', 'dementia', 'depression')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'urgent')),
  alert_type TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  related_reading_id UUID REFERENCES readings(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_condition_alerts_patient_status
  ON condition_alerts(patient_id, status, severity, created_at DESC);

-- Deduplication index: prevent duplicate open alerts of the same type per patient per day (Asia/Kolkata)
CREATE UNIQUE INDEX IF NOT EXISTS idx_condition_alerts_unique_open_per_day
  ON condition_alerts (
    patient_id,
    condition_type,
    alert_type,
    (date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata'))
  )
  WHERE status = 'open';

-- ── 5. caregiver_logs (mainly dementia) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS caregiver_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  logged_by TEXT NOT NULL DEFAULT 'caregiver',
  confusion_level INT NOT NULL CHECK (confusion_level BETWEEN 1 AND 5),
  sleep_quality INT NOT NULL CHECK (sleep_quality BETWEEN 1 AND 5),
  appetite INT NOT NULL CHECK (appetite BETWEEN 1 AND 5),
  agitation_or_wandering BOOLEAN NOT NULL DEFAULT FALSE,
  medicine_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caregiver_logs_patient_created
  ON caregiver_logs(patient_id, created_at DESC);

-- ── 6. mood_checks (depression) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mood_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  questionnaire TEXT NOT NULL CHECK (questionnaire IN ('phq2', 'phq9')),
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_score INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mood_checks_patient_created
  ON mood_checks(patient_id, created_at DESC);

-- ── 7. Update escalations reason to allow 'condition_alert' ──────────────────
-- Backfill & ensure escalations table allows condition_alert
DO $$
BEGIN
  -- If there is a check constraint on reason, alter it; otherwise reason is text
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%escalations_reason%'
  ) THEN
    ALTER TABLE escalations DROP CONSTRAINT IF EXISTS escalations_reason_check;
  END IF;
END $$;

-- ── 8. Enable Row Level Security (RLS) with NO public policies ───────────────
-- All access goes through server routes using the Supabase service role key,
-- never exposed to the client.
ALTER TABLE patient_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE condition_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_checks ENABLE ROW LEVEL SECURITY;

-- Grant permissions to service_role only
GRANT ALL ON patient_conditions TO service_role;
GRANT ALL ON readings TO service_role;
GRANT ALL ON care_plans TO service_role;
GRANT ALL ON condition_alerts TO service_role;
GRANT ALL ON caregiver_logs TO service_role;
GRANT ALL ON mood_checks TO service_role;

-- Revoke public / anon table access
REVOKE ALL ON patient_conditions FROM anon, authenticated;
REVOKE ALL ON readings FROM anon, authenticated;
REVOKE ALL ON care_plans FROM anon, authenticated;
REVOKE ALL ON condition_alerts FROM anon, authenticated;
REVOKE ALL ON caregiver_logs FROM anon, authenticated;
REVOKE ALL ON mood_checks FROM anon, authenticated;
