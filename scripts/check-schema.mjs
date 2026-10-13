// scripts/check-schema.mjs
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
config({ path: resolve(__dirname, ".env.local") });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const patientId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  // Check escalations table
  const { error: escError } = await supabase.from("escalations").insert({}).select();
  console.log("escalations insert error:", escError);

  // Check call_attempts with patient_id
  const { error: attemptsError } = await supabase.from("call_attempts").insert({ patient_id: patientId }).select();
  console.log("call_attempts with patient_id:", attemptsError);

  // Try to see what columns call_attempts has by inserting more fields
  const { error: attemptsError2 } = await supabase.from("call_attempts").insert({ 
    patient_id: patientId,
    call_type: "morning",
    outcome: "completed"
  }).select();
  console.log("call_attempts with more fields:", attemptsError2);
}

check();