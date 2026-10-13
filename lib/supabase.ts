// lib/supabase.ts
// Supabase client (server-side only, uses service role key)

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase credentials: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
}

export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export type TimelineInsert = {
  call_id: string;
  call_type: string;
  outcome: "completed" | "missed" | "declined" | "failed" | "busy" | "no-answer" | "canceled";
  medication_slot: "morning" | "evening" | "none";
  medication_taken: "yes" | "no" | "unclear" | "not_asked";
  symptom: string | null;
  severity: "none" | "mild" | "moderate" | "severe" | "unclear";
  symptom_trend: "new" | "improved" | "same" | "worse" | "not_applicable";
  concern_level: 1 | 2 | 3;
  emergency: boolean;
  summary: string;
  transcript_json: string;
};

export type CallAttemptInsert = {
  patient_id: string;
  attempt_number: number;
  call_type: string;
  outcome: string;
  call_sid: string | null;
  duration_seconds: number | null;
  transcript_json: string | null;
  concern_level: number | null;
  emergency: boolean | null;
};

export type EscalationInsert = {
  patient_id: string;
  call_id: string;
  reason: string;
  level: number;
  acknowledged: boolean;
  acknowledged_at: string | null;
};

export async function upsertTimeline(row: TimelineInsert) {
  const { error } = await supabase
    .from("timeline")
    .upsert(row, { onConflict: "call_id" });

  if (error) {
    console.error("[supabase] upsertTimeline error:", error);
    return false;
  }
  return true;
}

export async function insertCallAttempt(row: CallAttemptInsert) {
  const { error } = await supabase
    .from("call_attempts")
    .insert(row);

  if (error) {
    console.error("[supabase] insertCallAttempt error:", error);
    return false;
  }
  return true;
}

export async function insertEscalation(row: EscalationInsert) {
  const { error } = await supabase
    .from("escalations")
    .insert(row);

  if (error) {
    console.error("[supabase] insertEscalation error:", error);
    return false;
  }
  return true;
}

export async function getPatientIdByPhone(phone: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("patients")
    .select("id")
    .eq("phone", phone)
    .single();

  if (error || !data) return null;
  return data.id;
}