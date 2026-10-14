// app/api/patients/route.ts
// GET: lists all active patients with condition chips, open alerts, and severity status
// POST: creates a new patient in Supabase and registers their conditions

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabaseServer";
import {
  getPatientConditions,
  getConditionAlerts,
  getReadings,
  setPatientCondition,
} from "@/lib/conditionsDb";
import type { ConditionType } from "@/types/conditions";

export async function GET() {
  try {
    const supabase = db.get();
    const { data: patients, error } = await supabase
      .from("patients")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error || !patients) {
      console.error("[api/patients] Supabase query error:", error);
      return NextResponse.json({ error: error?.message || "Failed to load patients" }, { status: 500 });
    }

    const enhancedPatients = await Promise.all(
      patients.map(async (p: any) => {
        try {
          let activeConditions: ConditionType[] = [];
          try {
            const conditions = await getPatientConditions(p.id);
            activeConditions = conditions.filter((c) => c.is_active).map((c) => c.condition_type);
          } catch (e) {
            console.warn(`[api/patients] Conditions lookup failed for ${p.id}:`, e);
          }

          let openAlerts: any[] = [];
          try {
            openAlerts = await getConditionAlerts({ patientId: p.id, status: "open" });
          } catch (e) {
            console.warn(`[api/patients] Alerts lookup failed for ${p.id}:`, e);
          }

          const urgentCount = openAlerts.filter((a) => a.severity === "urgent").length;
          const warningCount = openAlerts.filter((a) => a.severity === "warning").length;

          let status: "red" | "amber" | "green" = "green";
          if (urgentCount > 0) {
            status = "red";
          } else if (warningCount > 0 || p.recheck_pending || p.last_contact_status === "no") {
            status = "amber";
          }

          const summaries: string[] = [];
          try {
            const latestReadings = await getReadings({ patientId: p.id, limit: 5 });
            const latestSys = latestReadings.find((r) => r.reading_type === "systolic");
            const latestDia = latestReadings.find((r) => r.reading_type === "diastolic");
            if (latestSys) {
              summaries.push(`BP ${latestSys.value}${latestDia ? `/${latestDia.value}` : ""} mmHg`);
            }
            const latestGlu = latestReadings.find((r) => r.reading_type.startsWith("glucose"));
            if (latestGlu) {
              summaries.push(`Glucose ${latestGlu.value} mg/dL`);
            }
          } catch (e) {
            console.warn(`[api/patients] Readings lookup failed for ${p.id}:`, e);
          }

          return {
            id: p.id,
            name: p.name,
            phone: p.phone,
            family_phone: p.family_phone,
            conditions: activeConditions,
            last_contact_status: p.last_contact_status,
            recheck_pending: p.recheck_pending,
            recheck_due_at: p.recheck_due_at,
            medications: p.medications,
            notes: p.notes,
            open_alerts_count: openAlerts.length,
            urgent_alerts_count: urgentCount,
            warning_alerts_count: warningCount,
            status,
            latest_vitals_summary: summaries.join(" · ") || "No recent vitals",
            updated_at: p.updated_at,
          };
        } catch (patientErr) {
          console.error(`[api/patients] Patient processing error for ${p.id}:`, patientErr);
          return {
            id: p.id,
            name: p.name,
            phone: p.phone,
            family_phone: p.family_phone,
            conditions: [],
            last_contact_status: p.last_contact_status,
            recheck_pending: false,
            recheck_due_at: null,
            medications: p.medications,
            notes: p.notes,
            open_alerts_count: 0,
            urgent_alerts_count: 0,
            warning_alerts_count: 0,
            status: "green" as const,
            latest_vitals_summary: "No recent vitals",
            updated_at: p.updated_at,
          };
        }
      })
    );

    return NextResponse.json({ patients: enhancedPatients });
  } catch (err: any) {
    console.error("[api/patients] Root error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      phone,
      family_phone,
      medications,
      notes,
      conditions = [],
      hasDiabetes = false,
      hasHypertension = false,
      isDeaf = false,
      age = null,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
    }

    const defaultPhone = phone?.trim() || `+91${Math.floor(6000000000 + Math.random() * 3999999999)}`;
    const supabase = db.get();

    const defaultFamilyPhone = family_phone?.trim() || process.env.CAREGIVER_PHONE_NUMBER || defaultPhone;

    // 1. Insert patient into Supabase patients table
    const { data: createdPatient, error: insertError } = await supabase
      .from("patients")
      .insert({
        name: name.trim(),
        phone: defaultPhone,
        family_phone: defaultFamilyPhone,
        medications: medications || null,
        notes: notes ? `${notes} ${age ? `(Age: ${age})` : ""}`.trim() : age ? `Age: ${age}` : null,
        is_active: true,
      })
      .select()
      .single();

    if (insertError || !createdPatient) {
      console.error("[api/patients] Patient insert error:", insertError);
      return NextResponse.json({ error: insertError?.message || "Failed to create patient" }, { status: 500 });
    }

    // 2. Attach conditions
    const conditionList: ConditionType[] = [];
    if (Array.isArray(conditions)) {
      for (const c of conditions) {
        const lower = String(c).toLowerCase();
        if (lower.includes("diabetes") && !conditionList.includes("diabetes")) conditionList.push("diabetes");
        if ((lower.includes("hypertension") || lower.includes("bp") || lower.includes("pressure")) && !conditionList.includes("hypertension")) conditionList.push("hypertension");
        if (lower.includes("dementia") && !conditionList.includes("dementia")) conditionList.push("dementia");
        if (lower.includes("depression") && !conditionList.includes("depression")) conditionList.push("depression");
      }
    }
    if (hasDiabetes && !conditionList.includes("diabetes")) conditionList.push("diabetes");
    if (hasHypertension && !conditionList.includes("hypertension")) conditionList.push("hypertension");

    for (const cond of conditionList) {
      try {
        await setPatientCondition(createdPatient.id, cond, true);
      } catch (condErr) {
        console.warn(`[api/patients] Failed to attach condition ${cond}:`, condErr);
      }
    }

    console.log(`[api/patients] Patient created: ${createdPatient.name} (id: ${createdPatient.id}) with conditions:`, conditionList);

    return NextResponse.json({
      patient: {
        ...createdPatient,
        conditions: conditionList,
      },
    }, { status: 201 });
  } catch (err: any) {
    console.error("[api/patients] POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
