-- ============================================================
-- Raksha v2 Migration — "Press 2 / Missed Dose" full flow
-- Run ONCE in the Supabase SQL Editor (service-role context).
-- All ALTER TABLE statements use IF NOT EXISTS so re-running is safe.
-- ============================================================

-- ── 1. call_attempts: flag whether this was a re-check call ──────────────────
ALTER TABLE call_attempts
  ADD COLUMN IF NOT EXISTS is_recheck BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. escalations: add reason column ───────────────────────────────────────
--    Allowed values: 'unreachable' | 'missed_dose_reported'
ALTER TABLE escalations
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- Back-fill existing rows (everything before v2 was "unreachable")
UPDATE escalations SET reason = 'unreachable' WHERE reason IS NULL;

-- Make NOT NULL with a sensible default
ALTER TABLE escalations
  ALTER COLUMN reason SET NOT NULL,
  ALTER COLUMN reason SET DEFAULT 'unreachable';

-- ── 3. patients: recheck scheduling columns ──────────────────────────────────
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS recheck_due_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recheck_pending  BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 4. Replace the old one-per-day unique index with per-reason per IST-day ──
DROP INDEX IF EXISTS escalations_patient_day_idx;

-- New rule: at most one escalation row per patient × reason × IST calendar day.
-- date_trunc('day', ... AT TIME ZONE 'Asia/Kolkata') gives the IST midnight boundary.
CREATE UNIQUE INDEX IF NOT EXISTS escalations_patient_reason_day_idx
  ON escalations (
    patient_id,
    reason,
    date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata')
  );

-- ── 5. Dashboard view: one row per active patient with derived status label ───
CREATE OR REPLACE VIEW v_patient_status AS
SELECT
  p.id,
  p.name,
  p.phone,
  p.family_phone,
  p.medications,
  p.last_contact_status,
  p.recheck_pending,
  p.recheck_due_at,
  p.is_active,
  p.updated_at,
  -- Most recent call attempt (any outcome, including re-checks)
  (
    SELECT row_to_json(q)
    FROM (
      SELECT ca.outcome, ca.is_recheck, ca.created_at, ca.twilio_call_sid
      FROM   call_attempts ca
      WHERE  ca.patient_id = p.id
      ORDER  BY ca.created_at DESC
      LIMIT  1
    ) q
  ) AS latest_attempt,
  -- Today's escalations in IST
  (
    SELECT json_agg(row_to_json(q) ORDER BY e2.created_at DESC)
    FROM   escalations e2
    JOIN   LATERAL (
             SELECT e2.id, e2.reason, e2.sms_sent_to, e2.created_at
           ) q ON TRUE
    WHERE  e2.patient_id = p.id
      AND  date_trunc('day', e2.created_at AT TIME ZONE 'Asia/Kolkata')
             = date_trunc('day', now()      AT TIME ZONE 'Asia/Kolkata')
  ) AS todays_escalations,
  -- Single label for the care-team dashboard badge
  CASE
    WHEN p.last_contact_status = 'yes'
         AND p.recheck_pending = FALSE                        THEN 'resolved'
    WHEN p.recheck_pending = TRUE                             THEN 'recheck_pending'
    WHEN p.last_contact_status = 'no'                         THEN 'missed_dose_reported'
    WHEN p.last_contact_status IN ('no-answer','failed','unclear') THEN 'unreachable'
    ELSE 'unknown'
  END AS dashboard_status
FROM patients p
WHERE p.is_active = TRUE;

-- Allow the anon / authenticated roles used by the Next.js frontend to read
GRANT SELECT ON v_patient_status TO anon, authenticated;
