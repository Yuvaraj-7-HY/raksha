// lib/supabaseServer.ts
// Server-only Supabase client using the service role key.
// This bypasses RLS — NEVER import this from a "use client" component or
// expose it to the browser. Only use in API routes / server code.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
  id: string;
  name: string;
  phone: string;
  family_phone: string;
  medications: string | null;
  risk_score: number | null;
  last_contact_status: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CallAttempt = {
  id: string;
  patient_id: string;
  attempt_number: number;
  outcome: string;
  twilio_call_sid: string | null;
  raw_digits: string | null;
  created_at: string;
};

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

export type CallOutcome = "yes" | "no" | "unclear" | "no-answer" | "failed";
export type ContactStatus = "yes" | "no" | "unclear" | "no-answer" | "never";

/**
 * Insert a single immutable call_attempts record with the known final outcome.
 * Call this ONCE per call — either from /api/gather (patient responded)
 * or from /api/voice/status (no-answer / failed).
 */
export async function insertCallAttempt(opts: {
  patientId: string;
  twilioCallSid: string | null;
  outcome: CallOutcome;
  rawDigits?: string;
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
    })
    .select("id")
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

/** Update last_contact_status on the patient row. */
export async function updatePatientStatus(
  patientId: string,
  status: ContactStatus
): Promise<void> {
  const { error } = await getServerClient()
    .from("patients")
    .update({ last_contact_status: status, updated_at: new Date().toISOString() })
    .eq("id", patientId);

  if (error) throw error;
}
