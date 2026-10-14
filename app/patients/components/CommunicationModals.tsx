// app/patients/components/CommunicationModals.tsx
// Reusable SMS & Call modals and communication actions with Twilio backend integration

"use client";

import { useState, useEffect } from "react";
import type { Patient, CaregiverContact, CommunicationLog } from "@/types";
import { logCommunication, getPrimaryCaregiver, getLastSms, updatePatient } from "@/lib/storage";

// ── Send SMS Modal ──────────────────────────────────────────────────────────
export function SendSmsModal({
  isOpen,
  onClose,
  patient,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onSuccess?: (msg: string) => void;
}) {
  const [selectedCaregiver, setSelectedCaregiver] = useState<CaregiverContact | null>(null);
  const [customPhone, setCustomPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (patient) {
      const primary = getPrimaryCaregiver(patient);
      setSelectedCaregiver(primary || null);
      let caregiverPhone = primary?.phone || "";
      const cleanCaregiver = caregiverPhone.replace(/\D/g, "");
      const cleanPatient = (patient.phone || "").replace(/\D/g, "");
      if (!caregiverPhone || cleanCaregiver.endsWith("7406842246") || (cleanPatient && cleanCaregiver === cleanPatient)) {
        caregiverPhone = process.env.NEXT_PUBLIC_DEFAULT_CAREGIVER_PHONE || "+91 8073909604";
      }
      setCustomPhone(caregiverPhone);
      setMessage(
        `Hello, this is a check-in from the care team regarding ${patient.name}. Please check on them and their medication. Thank you.`
      );
      setErrorMessage(null);
    }
  }, [patient, isOpen]);

  if (!isOpen || !patient) return null;

  const handleTemplateSelect = (text: string) => {
    setMessage(text);
  };

  const handleSend = async () => {
    const targetPhone = customPhone.trim();
    if (!targetPhone) {
      setErrorMessage("Please specify a caregiver phone number.");
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          patientName: patient.name,
          caregiverPhone: targetPhone,
          caregiverName: selectedCaregiver?.name || "Caregiver",
          message: message.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorText = data.error || "Failed to deliver SMS. Check Twilio credentials.";
        setErrorMessage(errorText);
        // Log failed attempt
        logCommunication({
          patientId: patient.id,
          type: "sms",
          to: targetPhone,
          recipientName: selectedCaregiver?.name || "Caregiver",
          message: message.trim(),
          status: "failed",
          error: errorText,
        });
        return;
      }

      // Log successful communication in localStorage
      logCommunication({
        patientId: patient.id,
        type: "sms",
        to: targetPhone,
        recipientName: selectedCaregiver?.name || "Caregiver",
        message: message.trim(),
        status: "sent",
        sid: data.sid,
      });

      onSuccess?.(`SMS sent successfully to ${selectedCaregiver?.name || "caregiver"} (${targetPhone})!`);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Network error. Please verify server connection.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#EDF7FE",
          border: "1.5px solid #7DD3FC",
          borderRadius: 20,
          maxWidth: 500,
          width: "100%",
          padding: "24px 26px",
          boxShadow: "0 25px 50px -12px rgba(12, 133, 208, 0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "#BAE6FD",
                border: "1px solid #7DD3FC",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              💬
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#083457" }}>
                Send SMS to Caregiver
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "#12578A" }}>
                Patient: <span style={{ fontWeight: 700, color: "#083457" }}>{patient.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSending}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              color: "#12578A",
              cursor: "pointer",
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Caregiver selection */}
        {patient.caregivers && patient.caregivers.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#083457", marginBottom: 6 }}>
              Select Recipient:
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {patient.caregivers.map((cg, i) => {
                const isSelected = selectedCaregiver?.phone === cg.phone;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setSelectedCaregiver(cg);
                      setCustomPhone(cg.phone);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 10,
                      border: isSelected ? "2px solid #1DA1F2" : "1.5px solid #BAE6FD",
                      background: isSelected ? "#BAE6FD" : "#F0F9FF",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#083457",
                      cursor: "pointer",
                    }}
                  >
                    👤 {cg.name} ({cg.relation})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Phone Input */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#083457", marginBottom: 6 }}>
            Caregiver Phone Number (Twilio Destination):
          </label>
          <input
            type="text"
            value={customPhone}
            onChange={(e) => setCustomPhone(e.target.value)}
            placeholder="+91 98450 12345 or +1..."
            disabled={isSending}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1.5px solid #7DD3FC",
              background: "#F0F9FF",
              fontSize: 14,
              color: "#083457",
              fontWeight: 600,
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Quick Message Templates */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#12578A", marginBottom: 6 }}>
            Quick Template Presets:
          </label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() =>
                handleTemplateSelect(
                  `Hello, this is a check-in from the care team regarding ${patient.name}. Please check on them and their medication. Thank you.`
                )
              }
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                background: "#E0F2FE",
                border: "1px solid #7DD3FC",
                fontSize: 11,
                fontWeight: 700,
                color: "#083457",
                cursor: "pointer",
              }}
            >
              Medication Check-in
            </button>
            <button
              type="button"
              onClick={() =>
                handleTemplateSelect(
                  `Urgent: ${patient.name} has missed scheduled doses today. Please follow up and assist them immediately.`
                )
              }
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                background: "#FEE2E2",
                border: "1px solid #FCA5A5",
                fontSize: 11,
                fontWeight: 700,
                color: "#B91C1C",
                cursor: "pointer",
              }}
            >
              Missed Dose Alert
            </button>
            <button
              type="button"
              onClick={() =>
                handleTemplateSelect(
                  `Routine Update: ${patient.name} has logged vitals and is doing well today. No immediate action required.`
                )
              }
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                background: "#BAE6FD",
                border: "1px solid #7DD3FC",
                fontSize: 11,
                fontWeight: 700,
                color: "#083457",
                cursor: "pointer",
              }}
            >
              Vitals Normal
            </button>
          </div>
        </div>

        {/* Message Input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#083457", marginBottom: 6 }}>
            SMS Text:
          </label>
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSending}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1.5px solid #7DD3FC",
              background: "#F0F9FF",
              fontSize: 13,
              color: "#083457",
              lineHeight: 1.5,
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: "#12578A" }}>{message.length} characters</span>
          </div>
        </div>

        {/* Error banner */}
        {errorMessage && (
          <div
            style={{
              background: "#FEE2E2",
              border: "1px solid #FCA5A5",
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 16,
              fontSize: 12,
              color: "#991B1B",
              lineHeight: 1.4,
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Footer actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            style={{
              padding: "9px 16px",
              borderRadius: 10,
              border: "1.5px solid #7DD3FC",
              background: "#E0F2FE",
              fontSize: 13,
              fontWeight: 700,
              color: "#083457",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            style={{
              padding: "9px 20px",
              borderRadius: 10,
              border: "none",
              background: isSending ? "#BAE6FD" : "linear-gradient(135deg, #1DA1F2 0%, #0C85D0 100%)",
              fontSize: 13,
              fontWeight: 800,
              color: "#FFFFFF",
              cursor: isSending ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 14px rgba(12, 133, 208, 0.3)",
            }}
          >
            {isSending ? (
              <>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    border: "2px solid #fff",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Sending via Twilio...
              </>
            ) : (
              <>
                <span>🚀</span>
                Send SMS Now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Call Caregiver Modal ────────────────────────────────────────────────────
export function CallCaregiverModal({
  isOpen,
  onClose,
  patient,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onSuccess?: (msg: string) => void;
}) {
  const [selectedCaregiver, setSelectedCaregiver] = useState<CaregiverContact | null>(null);
  const [customPhone, setCustomPhone] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (patient) {
      const primary = getPrimaryCaregiver(patient);
      setSelectedCaregiver(primary || null);
      let caregiverPhone = primary?.phone || "";
      const cleanCaregiver = caregiverPhone.replace(/\D/g, "");
      const cleanPatient = (patient.phone || "").replace(/\D/g, "");
      if (!caregiverPhone || cleanCaregiver.endsWith("7406842246") || (cleanPatient && cleanCaregiver === cleanPatient)) {
        caregiverPhone = process.env.NEXT_PUBLIC_DEFAULT_CAREGIVER_PHONE || "+91 8073909604";
      }
      setCustomPhone(caregiverPhone);
      setErrorMessage(null);
    }
  }, [patient, isOpen]);

  if (!isOpen || !patient) return null;

  const handleTwilioCall = async () => {
    const targetPhone = customPhone.trim();
    if (!targetPhone) {
      setErrorMessage("Please enter a valid phone number to call.");
      return;
    }

    setIsCalling(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/make-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          patientName: patient.name,
          caregiverPhone: targetPhone,
          caregiverName: selectedCaregiver?.name || "Caregiver",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorText = data.error || "Failed to initiate call via Twilio.";
        setErrorMessage(errorText);
        logCommunication({
          patientId: patient.id,
          type: "call",
          to: targetPhone,
          recipientName: selectedCaregiver?.name || "Caregiver",
          status: "failed",
          error: errorText,
        });
        return;
      }

      logCommunication({
        patientId: patient.id,
        type: "call",
        to: targetPhone,
        recipientName: selectedCaregiver?.name || "Caregiver",
        status: "sent",
        sid: data.sid,
      });

      onSuccess?.(`Calling ${selectedCaregiver?.name || "caregiver"} (${targetPhone}). SID: ${data.sid}`);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to make call.");
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#EDF7FE",
          border: "1.5px solid #7DD3FC",
          borderRadius: 20,
          maxWidth: 460,
          width: "100%",
          padding: "24px 26px",
          boxShadow: "0 25px 50px -12px rgba(12, 133, 208, 0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "#BAE6FD",
                border: "1px solid #7DD3FC",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              📞
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#083457" }}>
                Call Caregiver
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "#12578A" }}>
                Patient: <span style={{ fontWeight: 700, color: "#083457" }}>{patient.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isCalling}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              color: "#94A3B8",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Caregiver Selection Chips */}
        {patient.caregivers && patient.caregivers.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
              Select Caregiver:
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {patient.caregivers.map((cg, i) => {
                const isSelected = selectedCaregiver?.phone === cg.phone;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setSelectedCaregiver(cg);
                      setCustomPhone(cg.phone);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 10,
                      border: isSelected ? "2px solid #00C896" : "1.5px solid #E2E8F0",
                      background: isSelected ? "#ECFDF5" : "#F8FAFC",
                      fontSize: 12,
                      fontWeight: 700,
                      color: isSelected ? "#065F46" : "#475569",
                      cursor: "pointer",
                    }}
                  >
                    👤 {cg.name} ({cg.relation})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Editable Phone Number Input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
            Caregiver Phone Number (Editable):
          </label>
          <input
            type="text"
            value={customPhone}
            onChange={(e) => setCustomPhone(e.target.value)}
            placeholder="+91 98450 12345 or +1..."
            disabled={isCalling}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1.5px solid #CBD5E1",
              fontSize: 14,
              color: "#0F172A",
              fontWeight: 700,
              boxSizing: "border-box",
            }}
          />
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748B" }}>
            ✏️ You can edit this phone number before initiating the call.
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              background: "#FEE2E2",
              border: "1px solid #FCA5A5",
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 16,
              fontSize: 12,
              color: "#991B1B",
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* 1. Automated Twilio Call */}
          <button
            type="button"
            onClick={handleTwilioCall}
            disabled={isCalling || !customPhone.trim()}
            style={{
              padding: "12px",
              borderRadius: 12,
              border: "none",
              background: isCalling || !customPhone.trim() ? "#BAE6FD" : "linear-gradient(135deg, #1DA1F2 0%, #0C85D0 100%)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              cursor: isCalling || !customPhone.trim() ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 4px 14px rgba(12, 133, 208, 0.3)",
            }}
          >
            {isCalling ? (
              <>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    border: "2px solid #fff",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Calling via Twilio...
              </>
            ) : (
              <>📞 Initiate Twilio Voice Call ({customPhone || "No number"})</>
            )}
          </button>

          {/* 2. Device Dialer Fallback */}
          <a
            href={customPhone ? `tel:${customPhone.replace(/[\s\-()]/g, "")}` : "#"}
            style={{
              padding: "11px",
              borderRadius: 12,
              border: "1.5px solid #7DD3FC",
              background: "#E0F2FE",
              color: "#083457",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              textAlign: "center",
              display: "block",
            }}
          >
            📱 Open in Device Dialer ({customPhone || "Enter phone"})
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Last SMS note badge ─────────────────────────────────────────────────────
export function LastSmsNote({ patientId }: { patientId: string }) {
  const [lastSms, setLastSms] = useState<CommunicationLog | undefined>(undefined);

  useEffect(() => {
    setLastSms(getLastSms(patientId));
  }, [patientId]);

  if (!lastSms) return null;

  const timeStr = new Date(lastSms.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = new Date(lastSms.timestamp).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        color: "#047857",
        background: "#ECFDF5",
        padding: "2px 8px",
        borderRadius: 6,
        fontWeight: 600,
      }}
      title={`Sent to ${lastSms.to}: "${lastSms.message}"`}
    >
      <span>💬</span>
      Last SMS sent: {dateStr} at {timeStr}
    </span>
  );
}

// ── Call Patient Medication Check Modal (With Editable Phone & Press 1/2 Flow) ──
export function CallPatientMedCheckModal({
  isOpen,
  onClose,
  patient,
  onSuccess,
  onPatientUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onSuccess?: (msg: string) => void;
  onPatientUpdated?: (updated: Patient) => void;
}) {
  const [patientPhone, setPatientPhone] = useState("");
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [isCalling, setIsCalling] = useState(false);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [liveResponse, setLiveResponse] = useState<"Taken" | "Not Taken" | "Skipped" | "Rescheduled" | "No Response" | null>(null);
  const [detectedDigit, setDetectedDigit] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (patient) {
      setPatientPhone(
        patient.phone ||
        process.env.NEXT_PUBLIC_DEFAULT_PATIENT_PHONE ||
        "+917406842246"
      );
      setErrorMessage(null);
      setCallStatus(null);
      setLiveResponse(null);
      setDetectedDigit(null);
      setIsCalling(false);
    }
  }, [patient, isOpen]);

  if (!isOpen || !patient) return null;

  const isDeaf = Boolean(patient.isDeaf);

  const handleSimulateKey = async (digit: "1" | "2" | "3" | "4") => {
    try {
      const res = await fetch("/api/call-patient/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          reply: digit,
          source: isDeaf ? "deaf_sms_simulation" : "voice_keypad_simulation",
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (digit === "1") {
          setLiveResponse("Taken");
          setDetectedDigit("1");
          setCallStatus(isDeaf ? "✓ Patient replied '1': Medicine TAKEN! (Sent to Telegram bot)" : "✓ Keypad response: Patient confirmed TAKEN (Key 1)! (Sent to Telegram bot)");
        } else if (digit === "2") {
          setLiveResponse("Not Taken");
          setDetectedDigit("2");
          setCallStatus(isDeaf ? "✕ Patient replied '2': Medicine NOT TAKEN! Caregiver alerted & sent to Telegram bot." : "✕ Keypad response: Patient indicated NOT TAKEN (Key 2)! Sent to Telegram bot.");
        } else if (digit === "3") {
          setLiveResponse("Skipped");
          setDetectedDigit("3");
          setCallStatus(isDeaf ? "⏭️ Patient replied '3': Dose SKIPPED! (Sent to Telegram bot)" : "⏭️ Keypad response: Dose SKIPPED (Key 3)! (Sent to Telegram bot)");
        } else if (digit === "4") {
          setLiveResponse("Rescheduled");
          setDetectedDigit("4");
          setCallStatus(isDeaf ? "⏰ Patient replied '4': Dose RESCHEDULED! (Sent to Telegram bot)" : "⏰ Keypad response: Dose RESCHEDULED (Key 4)! (Sent to Telegram bot)");
        }
        setIsCalling(false);
        onSuccess?.(`Recorded reply ${digit} & broadcasted update to Telegram bot.`);
      }
    } catch (e: any) {
      alert("Simulation failed: " + e.message);
    }
  };

  const handleStartMedCheckCall = async () => {
    const targetPhone = patientPhone.trim();
    if (!targetPhone) {
      setErrorMessage("Please enter a valid phone number.");
      return;
    }

    setIsCalling(true);
    setErrorMessage(null);
    setCallStatus(
      isDeaf
        ? "Sending interactive reminder SMS & Telegram message..."
        : "Placing Twilio outbound call..."
    );
    setLiveResponse(null);
    setDetectedDigit(null);

    // Save phone number to patient profile if requested
    if (saveToProfile && targetPhone !== patient.phone) {
      const updated = updatePatient(patient.id, { phone: targetPhone });
      if (updated && onPatientUpdated) onPatientUpdated(updated);
    }

    try {
      const res = await fetch("/api/call-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          patientName: patient.name,
          phone: targetPhone,
          isDeaf,
          telegramChatId: (patient as any).telegramChatId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to initiate medication check.");
      }

      setCallStatus(
        isDeaf
          ? `Interactive reminder sent to ${targetPhone} via SMS & Telegram. Waiting for patient reply (1 = Taken, 2 = Not Taken)...`
          : `Call ringing at ${targetPhone}. Waiting for patient to answer and press 1 or 2...`
      );
      onSuccess?.(
        isDeaf
          ? `Reminder sent to ${patient.name} (${targetPhone}) via SMS & Telegram.`
          : `Calling ${patient.name} (${targetPhone}). Listen for keypad response.`
      );

      // Log communication
      logCommunication({
        patientId: patient.id,
        type: isDeaf ? "sms" : "call",
        to: targetPhone,
        recipientName: patient.name,
        message: isDeaf ? "Deaf reminder: Reply 1 if taken, 2 if not taken" : undefined,
        status: "sent",
        sid: data.callSid || data.smsSid,
      });

      // Poll server-side store for response
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const resp = await fetch(`/api/call-patient/responses?patientId=${encodeURIComponent(patient.id)}`);
          const d = await resp.json();
          if (d.success && d.latest) {
            const respVal = d.latest.response;
            const digitVal = d.latest.digits || d.latest.digits_pressed;
            if (respVal === "Taken" || digitVal === "1") {
              setLiveResponse("Taken");
              setDetectedDigit("1");
              setCallStatus(isDeaf ? "✓ Patient replied '1': Medicine confirmed TAKEN!" : "✓ Keypad response received: Patient confirmed TAKEN (Key 1)!");
              clearInterval(interval);
              setIsCalling(false);
            } else if (respVal === "Not Taken" || digitVal === "2") {
              setLiveResponse("Not Taken");
              setDetectedDigit("2");
              setCallStatus(isDeaf ? "✕ Patient replied '2': Medicine NOT TAKEN. Caregiver alerted." : "✕ Keypad response received: Patient indicated NOT TAKEN (Key 2)!");
              clearInterval(interval);
              setIsCalling(false);
            } else if (respVal === "No Response") {
              setLiveResponse("No Response");
              setCallStatus(isDeaf ? "⚪ No reply received from patient yet." : "⚪ Call ended without keypad input (No Response).");
              clearInterval(interval);
              setIsCalling(false);
            }
          }
        } catch (e) {
          console.warn("Polling error:", e);
        }

        if (attempts >= 25) {
          clearInterval(interval);
          setIsCalling(false);
          setCallStatus("Monitoring cycle finished. Latest result saved to dashboard.");
        }
      }, 2500);

    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to make call.");
      setIsCalling(false);
      setCallStatus(null);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 20,
          maxWidth: 500,
          width: "100%",
          padding: "24px 26px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: isDeaf ? "#EEF2FF" : "#EFF6FF",
                border: isDeaf ? "1px solid #C7D2FE" : "1px solid #BFDBFE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
              }}
            >
              {isDeaf ? "🧏" : "📞"}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0F172A" }}>
                  {isDeaf ? "Medication Check (Deaf Mode)" : "Patient Medication Check Call"}
                </h3>
                {isDeaf && (
                  <span style={{
                    padding: "2px 7px", borderRadius: 999, background: "#EDE9FE",
                    color: "#6D28D9", fontSize: 10, fontWeight: 800,
                  }}>
                    SMS + Telegram
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>
                Patient: <span style={{ fontWeight: 700, color: "#0F172A" }}>{patient.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isCalling}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              color: "#94A3B8",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* How It Works Explainer Box */}
        <div
          style={{
            background: isDeaf ? "#F5F3FF" : "#F8FAFC",
            border: isDeaf ? "1.5px solid #DDD6FE" : "1px solid #E2E8F0",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 16,
            fontSize: 12,
            color: "#334155",
            lineHeight: 1.5,
          }}
        >
          {isDeaf ? (
            <>
              <div style={{ fontWeight: 800, color: "#5B21B6", marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                <span>🧏</span> Deaf Patient Accessible Flow:
              </div>
              <p style={{ margin: "0 0 6px", fontSize: 12, color: "#475569" }}>
                Voice calls are bypassed. Raksha delivers interactive SMS &amp; Telegram messages:
              </p>
              <div style={{ background: "#fff", border: "1px dashed #C4B5FD", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "#374151" }}>
                &ldquo;Have you taken your medicine today? Reply <strong>1</strong> if medicine is taken, <strong>2</strong> if not taken.&rdquo;
              </div>
              <div style={{ marginTop: 6, display: "flex", gap: 12, fontSize: 11 }}>
                <span style={{ color: "#065F46", fontWeight: 700 }}>• Reply 1 = Taken ✅</span>
                <span style={{ color: "#991B1B", fontWeight: 700 }}>• Reply 2 = Not Taken ❌ (Alerts Caregiver)</span>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: 3, display: "flex", alignItems: "center", gap: 5 }}>
                <span>🤖</span> Twilio Voice &amp; Keypad Check:
              </div>
              AI speaks: <em>&ldquo;Have you taken your medicine today? If yes, press 1. If no, press 2.&rdquo;</em>
              <div style={{ marginTop: 4, display: "flex", gap: 10, fontSize: 11 }}>
                <span style={{ color: "#065F46", fontWeight: 700 }}>• Press 1 = Taken</span>
                <span style={{ color: "#991B1B", fontWeight: 700 }}>• Press 2 = Not Taken</span>
              </div>
            </>
          )}
        </div>

        {/* Editable Patient Phone Number Input */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
            Patient Phone Number (Editable):
          </label>
          <input
            type="text"
            value={patientPhone}
            onChange={(e) => setPatientPhone(e.target.value)}
            placeholder="+91 74068 42246"
            disabled={isCalling}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1.5px solid #CBD5E1",
              fontSize: 14,
              color: "#0F172A",
              fontWeight: 700,
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#475569", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={saveToProfile}
                onChange={(e) => setSaveToProfile(e.target.checked)}
                disabled={isCalling}
                style={{ accentColor: isDeaf ? "#7C3AED" : "#2563EB" }}
              />
              Save this number to {patient.name}&apos;s profile
            </label>
            <span style={{ fontSize: 11, color: "#64748B" }}>
              💡 E.164 (e.g. +91...)
            </span>
          </div>
        </div>

        {/* Live Call Result / Progress Indicator */}
        {callStatus && (
          <div
            style={{
              background: liveResponse === "Taken" ? "#ECFDF5" : liveResponse === "Not Taken" ? "#FEF2F2" : isDeaf ? "#F5F3FF" : "#EFF6FF",
              border: `1.5px solid ${liveResponse === "Taken" ? "#10B981" : liveResponse === "Not Taken" ? "#EF4444" : isDeaf ? "#C4B5FD" : "#BFDBFE"}`,
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 16,
              animation: "fadeIn 0.2s ease-in",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isCalling && (
                <span
                  style={{
                    width: 14,
                    height: 14,
                    border: `2px solid ${isDeaf ? "#7C3AED" : "#2563EB"}`,
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
              )}
              {liveResponse === "Taken" && <span style={{ fontSize: 18 }}>🎉</span>}
              {liveResponse === "Not Taken" && <span style={{ fontSize: 18 }}>⚠️</span>}
              {liveResponse === "No Response" && <span style={{ fontSize: 18 }}>⚪</span>}

              <div style={{ flex: 1 }}>
                <p style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 800,
                  color: liveResponse === "Taken" ? "#065F46" : liveResponse === "Not Taken" ? "#991B1B" : isDeaf ? "#5B21B6" : "#1E40AF"
                }}>
                  {liveResponse ? (
                    liveResponse === "Taken"
                      ? isDeaf ? "PATIENT REPLIED 1: MEDICINE TAKEN!" : "PATIENT PRESSED 1: MEDICINE TAKEN!"
                      : liveResponse === "Not Taken"
                      ? isDeaf ? "PATIENT REPLIED 2: MEDICINE NOT TAKEN" : "PATIENT PRESSED 2: MEDICINE NOT TAKEN"
                      : "NO RESPONSE RECORDED"
                  ) : (
                    isDeaf ? "Message Sent • Awaiting Reply" : "Call In Progress"
                  )}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#475569" }}>
                  {callStatus}
                </p>
              </div>

              {detectedDigit && (
                <div style={{
                  background: "#fff",
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid #CBD5E1",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#0F172A",
                }}>
                  Response: [{detectedDigit}]
                </div>
              )}
            </div>
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              background: "#FEE2E2",
              border: "1px solid #FCA5A5",
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 16,
              fontSize: 12,
              color: "#991B1B",
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* 1. Automated Send / Call Button */}
          <button
            type="button"
            onClick={handleStartMedCheckCall}
            disabled={isCalling || !patientPhone.trim()}
            style={{
              padding: "12px",
              borderRadius: 12,
              border: "none",
              background: isCalling || !patientPhone.trim()
                ? "#94A3B8"
                : isDeaf
                ? "#7C3AED"
                : "#2563EB",
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              cursor: isCalling || !patientPhone.trim() ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: isDeaf
                ? "0 4px 12px rgba(124, 58, 237, 0.25)"
                : "0 4px 12px rgba(37, 99, 235, 0.2)",
            }}
          >
            {isCalling ? (
              <>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    border: "2px solid #fff",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                {isDeaf ? "Delivering SMS & Telegram..." : `Calling ${patientPhone}...`}
              </>
            ) : isDeaf ? (
              <>💬 Send Medication Check Message (SMS &amp; Telegram)</>
            ) : (
              <>📞 Initiate Med Check Call ({patientPhone || "No number"})</>
            )}
          </button>

          {/* Quick Simulation Row for Testing */}
          <div style={{
            background: "#F8FAFC",
            border: "1px dashed #CBD5E1",
            borderRadius: 12,
            padding: "10px 12px",
          }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
              🧪 Simulator (Test Patient {isDeaf ? "SMS Reply" : "Keypad Input"}):
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                type="button"
                onClick={() => handleSimulateKey("1")}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1.5px solid #A7F3D0",
                  background: "#ECFDF5",
                  color: "#065F46",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                1️⃣ Taken ✅
              </button>
              <button
                type="button"
                onClick={() => handleSimulateKey("2")}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1.5px solid #FECACA",
                  background: "#FEF2F2",
                  color: "#991B1B",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                2️⃣ Not Taken ❌
              </button>
              <button
                type="button"
                onClick={() => handleSimulateKey("3")}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1.5px solid #CBD5E1",
                  background: "#F1F5F9",
                  color: "#334155",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                3️⃣ Skip ⏭️
              </button>
              <button
                type="button"
                onClick={() => handleSimulateKey("4")}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1.5px solid #FDE68A",
                  background: "#FEF3C7",
                  color: "#92400E",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                4️⃣ Reschedule ⏰
              </button>
            </div>
          </div>

          {/* Done / Close Button when finished */}
          {liveResponse && (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px",
                borderRadius: 10,
                border: "none",
                background: "#0F172A",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ✓ Done &amp; Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

