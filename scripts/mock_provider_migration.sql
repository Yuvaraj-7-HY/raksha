-- ============================================================================
-- scripts/mock_provider_migration.sql
-- Optional migration for Supabase call_attempts to support 'status' and 'next_attempt_at'
-- (Shown, not applied automatically as per project rules)
-- ============================================================================

-- 1. Add status column to call_attempts if it does not already exist
ALTER TABLE call_attempts
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

-- 2. Add next_attempt_at timestamp for retry scheduling
ALTER TABLE call_attempts
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;

-- 3. Create index for fast status querying
CREATE INDEX IF NOT EXISTS idx_call_attempts_status
  ON call_attempts(status);
