// lib/supabaseServer.ts
// Server-only Supabase client using the service role key.
// This bypasses RLS — NEVER import this from a "use client" component or
// expose it to the browser. Only use in API routes / server code.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type GlobalWithServerSupabase = typeof globalThis & {
  __supabaseServer?: SupabaseClient;
};

function getServerClient(): SupabaseClient {
  const g = globalThis as GlobalWithServerSupabase;
  if (!g.__supabaseServer) {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
      );
    }
    g.__supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return g.__supabaseServer;
}

export const db = { get: getServerClient };

// ── Typed helpers ─────────────────────────────────────────────────────────────

export type Patient = {
  id:                  string;
  name:                string;
  phone:               string;
  family_phone:        string;
  medications:         string | null;
  risk_score:          number | null;
  last_contact_status: string | null;
  notes:               string | null;
  is_active:           boolean;
  recheck_pending:     boolean;
  recheck_due_at:      string | null;
  created_at:          string;
  updated_at:          string;
};

export type CallAttempt = {
  id:              string;
  patient_id:      string;
  attempt_number:  number;
  outcome:         string;
  twilio_call_sid: string | null;
  raw_digits:      string | null;
  is_recheck:      boolean;
  created_at:      string;
};

export type CallOutcome   = "yes" | "no" | "unclear" | "no-answer" | "failed";
export type ContactStatus = "yes" | "no" | "unclear" | "no-answer" | "never";

/** Look up a patient by their E.164 phone number. */
export async function findPatientByPhone(
  phone: string
): Promise<Patient | null> {
  const { data, error } = await getServerClient()
    .from("patients")
    .select("*")
    .eq("phone", phone)
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  return data as Patient;
}

/** Look up a patient by ID. */
export async function findPatientById(
  id: string
): Promise<Patient | null> {
  const { data, error } = await getServerClient()
    .from("patients")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as Patient;
}

/**
 * Check whether a call_attempt row already exists for this twilio_call_sid.
 * Used for idempotency: Twilio can POST the same webhook twice on retries.
 */
export async function callAttemptExistsBySid(
  twilioCallSid: string
): Promise<boolean> {
  const { count, error } = await getServerClient()
    .from("call_attempts")
    .select("id", { count: "exact", head: true })
    .eq("twilio_call_sid", twilioCallSid);

  if (error) throw error;
  return (count ?? 0) > 0;
}

/**
 * Insert a single immutable call_attempts record with the known final outcome.
 * Call this ONCE per call — either from /api/gather (patient responded)
 * or from /api/voice/status (no-answer / failed).
 */
export async function insertCallAttempt(opts: {
  patientId:      string;
  twilioCallSid:  string | null;
  outcome:        CallOutcome;
  rawDigits?:     string;
  isRecheck?:     boolean;
}): Promise<string> {
  // Count existing attempts for attempt_number sequence.
  const { count } = await getServerClient()
    .from("call_attempts")
    .select("*", { count: "exact", head: true })
    .eq("patient_id", opts.patientId);

  const { data, error } = await getServerClient()
    .from("call_attempts")
    .insert({
      patient_id:      opts.patientId,
      attempt_number:  (count ?? 0) + 1,
      twilio_call_sid: opts.twilioCallSid,
      outcome:         opts.outcome,
      raw_digits:      opts.rawDigits ?? null,
      is_recheck:      opts.isRecheck ?? false,
    })
    .select("id")
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

/** Update last_contact_status (and optionally recheck fields) on the patient row. */
export async function updatePatientStatus(
  patientId: string,
  status:    ContactStatus,
  extra?: {
    recheckPending?: boolean;
    recheckDueAt?:  string | null;  // ISO timestamp
  }
): Promise<void> {
  const patch: Record<string, unknown> = {
    last_contact_status: status,
    updated_at:          new Date().toISOString(),
  };

  if (extra?.recheckPending !== undefined) patch.recheck_pending = extra.recheckPending;
  if (extra?.recheckDueAt   !== undefined) patch.recheck_due_at  = extra.recheckDueAt;

  const { error } = await getServerClient()
    .from("patients")
    .update(patch)
    .eq("id", patientId);

  if (error) throw error;
}

/**
 * Return all patients that are due for a re-check call.
 * "Due" means recheck_pending=true AND recheck_due_at <= now().
 */
export async function getPendingRechecks(): Promise<Patient[]> {
  const { data, error } = await getServerClient()
    .from("patients")
    .select("*")
    .eq("is_active", true)
    .eq("recheck_pending", true)
    .lte("recheck_due_at", new Date().toISOString());

  if (error) throw error;
  return (data ?? []) as Patient[];
}

/**
 * Mark a patient's re-check as dispatched (set recheck_pending=false).
 * Called right before placing the outbound call so we never double-dial.
 */
export async function clearRecheckPending(patientId: string): Promise<void> {
  const { error } = await getServerClient()
    .from("patients")
    .update({ recheck_pending: false, updated_at: new Date().toISOString() })
    .eq("id", patientId);

  if (error) throw error;
}
