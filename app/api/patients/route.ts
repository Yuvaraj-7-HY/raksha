// app/api/patients/route.ts
// GET: lists all active patients with condition chips, open alerts, and severity status
// POST: creates a new patient in Supabase

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabaseServer";
import { getPatientConditions, getConditionAlerts, getReadings } from "@/lib/conditionsDb";

export async function GET() {
  try {
    const supabase = db.get();
    const { data: patients, error } = await supabase
      .from("patients")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error || !patients) {
      return NextResponse.json({ error: error?.message || "Failed to load patients" }, { status: 500 });
    }

    const enhancedPatients = await Promise.all(
      patients.map(async (p: any) => {
        const conditions = await getPatientConditions(p.id);
        const activeConditions = conditions.filter((c) => c.is_active).map((c) => c.condition_type);
        const openAlerts = await getConditionAlerts({ patientId: p.id, status: "open" });

        const urgentCount = openAlerts.filter((a) => a.severity === "urgent").length;
        const warningCount = openAlerts.filter((a) => a.severity === "warning").length;

        // Derive overall clinical status:
        // Red = urgent condition alert or emergency
        // Amber = warning alert or missed dose / pending recheck
        // Green = normal
        let status: "red" | "amber" | "green" = "green";
        if (urgentCount > 0) {
          status = "red";
        } else if (warningCount > 0 || p.recheck_pending || p.last_contact_status === "no") {
          status = "amber";
        }

        // Get latest vital summary if available
        const latestReadings = await getReadings({ patientId: p.id, limit: 5 });
        const summaries: string[] = [];
        const latestSys = latestReadings.find((r) => r.reading_type === "systolic");
        const latestDia = latestReadings.find((r) => r.reading_type === "diastolic");
        if (latestSys) {
          summaries.push(`BP ${latestSys.value}${latestDia ? `/${latestDia.value}` : ""} mmHg`);
        }
        const latestGlu = latestReadings.find((r) => r.reading_type.startsWith("glucose"));
        if (latestGlu) {
          summaries.push(`Glucose ${latestGlu.value} mg/dL`);
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
      })
    );

    return NextResponse.json({ patients: enhancedPatients });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, family_phone, medications, notes } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: "Missing required fields: name, phone" }, { status: 400 });
    }

    const supabase = db.get();
    const { data, error } = await supabase
      .from("patients")
      .insert({
        name,
        phone,
        family_phone: family_phone || null,
        medications: medications || null,
        notes: notes || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ patient: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
