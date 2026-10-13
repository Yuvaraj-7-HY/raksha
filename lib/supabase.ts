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