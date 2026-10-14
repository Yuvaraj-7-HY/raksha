// components/landing/RakshaLandingPage.tsx
// High-impact Raksha+ landing page powered by the Onward interactive glyph field canvas.

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OnwardSummitTemplate, {
  type OwsFeature,
  type OwsAudience,
  type OwsSession,
  type OwsSpeaker,
  type OwsFaq,
  type OwsRegistration,
} from "./onward-summit-template";

export default function RakshaLandingPage() {
  const router = useRouter();

  const brandMark = (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 10,
        background: "linear-gradient(135deg, #1d9bf0 0%, #0a4d8c 100%)",
        color: "#ffffff",
        fontSize: 17,
        fontWeight: 900,
        marginRight: 8,
        boxShadow: "0 0 16px rgba(29, 155, 240, 0.45)",
      }}
    >
      🛡️
    </div>
  );

  const features: OwsFeature[] = [
    {
      icon: "arrow",
      title: "Autonomous Voice Calls",
      text: "Daily scheduled outbound phone calls in warm regional voices. Patients simply speak or press 1 to confirm their dose.",
    },
    {
      icon: "ring",
      title: "1-Minute Smart Re-check",
      text: "If Grandma misses the call or reports medicine not taken, Raksha automatically checks back in 60 seconds before escalating.",
    },
    {
      icon: "plus",
      title: "Caregiver & Family Alerts",
      text: "Real-time updates dispatched to Telegram bots and emergency SMS whenever doses are taken, delayed, or missed.",
    },
  ];

  const audiences: OwsAudience[] = [
    {
      role: "Elderly Patients",
      pitch:
        "No smartphones, apps, or passwords needed. A friendly voice calls your regular phone every morning and evening. Just answer like a normal call.",
    },
    {
      role: "Family Caregivers",
      pitch:
        "Stop worrying whether Mom took her diabetes and blood pressure medicines. Receive instant Telegram confirmations and alert notifications when intervention is needed.",
    },
    {
      role: "Physicians & Clinics",
      pitch:
        "Continuous medication adherence and blood pressure / glucose trends across chronic care cohorts, without time-consuming manual staff calls.",
    },
    {
      role: "Assisted Living Staff",
      pitch:
        "Automated medication check rounds with auditable call logs, timestamped patient responses, and escalation queues for priority care.",
    },
  ];

  const sessions: OwsSession[] = [
    {
      start: "08:00",
      duration: 3,
      title: "Morning Medication Adherence Call",
      track: "Voice Call",
      description:
        "Raksha dials the patient: 'Hello Grandma! Did you take your morning tablets?' Voice recognition captures speech in real time.",
    },
    {
      start: "08:01",
      duration: 1,
      title: "Intelligent 1-Minute Silence / 'Not Taken' Re-check",
      track: "Auto Re-check",
      description:
        "If the initial check is unanswered or Grandma indicates 'No', an automated re-check rings in 60 seconds to verify adherence.",
    },
    {
      start: "08:15",
      duration: 10,
      title: "Vital Signs & Condition Logging",
      track: "Vitals",
      description:
        "Captures blood pressure, blood glucose, and symptom severity for chronic diabetes and hypertension management.",
    },
    {
      start: "08:30",
      duration: 5,
      title: "Caregiver Escalation Dispatch",
      track: "Family Alert",
      description:
        "If repeat medication checks fail, emergency dispatches alert family members via Telegram and priority SMS.",
    },
    {
      start: "20:00",
      duration: 3,
      title: "Evening Dose Verification & Daily Summary",
      track: "Voice Call",
      description:
        "Confirms bedtime cardiovascular or insulin doses, wraps up the daily care timeline, and logs records to Supabase.",
    },
  ];

  const specialists: OwsSpeaker[] = [
    {
      name: "Dr. Priya Nair, MD",
      role: "Chief Medical Advisor",
      company: "Geriatric & Chronic Care Specialist",
      bio: "Over 18 years optimizing medication adherence and chronic hypertension care for senior citizens.",
    },
    {
      name: "Dr. Ramesh Iyer",
      role: "Clinical Cardiology Advisor",
      company: "Cardiovascular Health Lead",
      bio: "Pioneering preventive cardiac care and automated adherence protocols for post-stent recovery.",
    },
    {
      name: "Kavita Menon",
      role: "Caregiver Operations Lead",
      company: "Family Liaison Specialist",
      bio: "Designing empathetic senior voice experiences and instant family escalation workflows.",
    },
    {
      name: "Rajesh Patel",
      role: "Head of Remote Patient Monitoring",
      company: "Chronic Condition Systems",
      bio: "Architecting condition-aware care loops across diabetes, hypertension, and dementia monitoring.",
    },
  ];

  const faqs: OwsFaq[] = [
    {
      q: "Does the patient need a smartphone or internet connection?",
      a: "No! Raksha+ calls any regular telephone, landline, or basic feature phone over the standard telecom network. The patient simply talks into their receiver.",
    },
    {
      q: "What happens if a call goes to voicemail or Grandma doesn't answer?",
      a: "Raksha detects silence and unanswered attempts, automatically initiating a follow-up call after 1 minute. If still unanswered, an urgent escalation is dispatched to caregivers.",
    },
    {
      q: "How do family members receive notifications?",
      a: "Caregivers receive real-time updates directly on Telegram (@Raksha777bot) and via SMS whenever medication is confirmed taken, delayed, or missed.",
    },
    {
      q: "Which chronic conditions are supported?",
      a: "Raksha+ supports Type 2 Diabetes, Hypertension (High BP), Dementia, and Depression with condition-aware questions, threshold alerts, and vital tracking.",
    },
    {
      q: "Can I test the voice call right now in my browser?",
      a: "Yes! Click 'Try Simulated Call Demo' to experience the full AI voice conversation and speech recognition loop right on your screen without spending phone credits.",
    },
  ];

  return (
    <div style={{ position: "relative" }}>
      {/* Top Banner with Quick Actions */}
      <div
        style={{
          background: "linear-gradient(90deg, #1DA1F2 0%, #0C85D0 100%)",
          color: "#FFFFFF",
          fontSize: 12,
          fontWeight: 700,
          padding: "8px 16px",
          textAlign: "center",
          borderBottom: "1px solid #0A72B3",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span>🟢 Raksha+ Voice & Telegram Care Active</span>
        <span>•</span>
        <Link
          href="/demo-call"
          style={{
            color: "#FFFFFF",
            textDecoration: "underline",
            fontWeight: 800,
          }}
        >
          🎙️ Test Simulated Call Demo ➔
        </Link>
        <span>•</span>
        <Link
          href="/patients"
          style={{
            color: "#BAE6FD",
            textDecoration: "underline",
            fontWeight: 800,
          }}
        >
          Open Caregiver Dashboard ➔
        </Link>
      </div>

      <OnwardSummitTemplate
        brand="Raksha+"
        logo={brandMark}
        title="Never Miss a Dose."
        tagline="Automated Voice Medication Checks, 1-Minute Re-checks, & Caregiver Alerts for Elderly Chronic Care."
        date="24/7 Voice & Telegram Platform"
        city="Landline · Mobile · Telegram"
        startsAt="2026-11-12T08:00:00+05:30"
        palette="cobalt"
        glyph="arrow"
        register={{
          label: "Care Dashboard ➔",
          href: "/patients",
        }}
        expect={{
          title: "Intelligent Elderly Care",
          intro: "Designed for elderly patients with chronic conditions. Three core layers ensure medicine is taken safely every single day.",
          features,
        }}
        guests={{
          title: "Built for the Entire Care Circle",
          audiences,
        }}
        agenda={{
          title: "24-Hour Care Cycle Timeline",
          intro: "An automated adherence workflow that monitors morning, afternoon, and evening medication rounds with automatic follow-ups.",
          sessions,
        }}
        speakers={{
          title: "Clinical Advisors & Care Specialists",
          intro: "Guided by geriatricians, cardiologists, and chronic condition specialists dedicated to senior well-being.",
          people: specialists,
        }}
        venue={{
          title: "Voice Telecom & Cloud Infrastructure",
          name: "Global Voice Network & Cloud Telephony",
          address: "Direct Landline & Mobile Voice Delivery",
          city: "India & Global",
          notes: [
            "Works on all telecom operators (Jio, Airtel, Vi, BSNL)",
            "Integrated with Telegram Bot API & n8n workflow engine",
            "Supabase real-time cloud adherence database",
          ],
        }}
        faq={{
          title: "Frequently Asked Questions",
          items: faqs,
        }}
        cta={{
          kicker: "Protect Your Loved Ones",
          title: "Bring Peace of Mind to Your Family Today",
          subtitle: "Deploy proactive medication adherence calls, automatic 1-minute follow-ups, and caregiver alerts in less than 2 minutes.",
          seats: { total: 100, taken: 42 },
        }}
        footer={{
          links: [
            { label: "Care Dashboard", href: "/patients" },
            { label: "Simulated Call Demo", href: "/demo-call" },
            { label: "Add New Patient", href: "/patients/new" },
            { label: "Medication Schedule", href: "/medications" },
          ],
          note: "Raksha+ · Elderly Chronic Condition Medication Adherence Voice Platform.",
        }}
        onRegister={async (data: OwsRegistration) => {
          sessionStorage.setItem("raksha_toast", `Welcome ${data.name}! Redirecting to patient setup...`);
          router.push("/patients/new");
        }}
      />
    </div>
  );
}
