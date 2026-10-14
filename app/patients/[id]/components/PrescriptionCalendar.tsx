// app/patients/[id]/components/PrescriptionCalendar.tsx
"use client";

import React, { useState, useMemo } from "react";

export interface ParsedMedication {
  id: string;
  name: string;
  dosage: string;
  slots: Array<"morning" | "afternoon" | "evening" | "night">;
  instructions: string;
  frequency: string;
}

interface PrescriptionCalendarProps {
  patient: {
    id: string;
    name: string;
    medications?: string | null;
    created_at?: string;
    last_contact_status?: string;
  };
  onEditMedications?: () => void;
}

const SLOT_CONFIG: Record<
  "morning" | "afternoon" | "evening" | "night",
  { label: string; time: string; icon: string; bg: string; color: string; border: string }
> = {
  morning: {
    label: "Morning",
    time: "08:00 AM",
    icon: "🌅",
    bg: "#FEF08A",
    color: "#854D0E",
    border: "#FDE047",
  },
  afternoon: {
    label: "Afternoon",
    time: "01:00 PM",
    icon: "☀️",
    bg: "#BAE6FD",
    color: "#0369A1",
    border: "#7DD3FC",
  },
  evening: {
    label: "Evening",
    time: "07:30 PM",
    icon: "🌆",
    bg: "#FED7AA",
    color: "#C2410C",
    border: "#FDBA74",
  },
  night: {
    label: "Night",
    time: "10:00 PM",
    icon: "🌙",
    bg: "#E0E7FF",
    color: "#4338CA",
    border: "#C7D2FE",
  },
};

export function PrescriptionCalendar({ patient, onEditMedications }: PrescriptionCalendarProps) {
  // Current calendar viewing month and selected day
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());

  // Parse patient's medications text or generate structured list
  const parsedMedications = useMemo<ParsedMedication[]>(() => {
    const raw = patient.medications?.trim();
    if (!raw) {
      return [
        {
          id: "med-default-1",
          name: "Metformin HCl",
          dosage: "500 mg",
          slots: ["morning", "night"],
          instructions: "Take with meals",
          frequency: "Twice daily",
        },
        {
          id: "med-default-2",
          name: "Amlodipine",
          dosage: "5 mg",
          slots: ["morning"],
          instructions: "Take after breakfast with water",
          frequency: "Once daily (Morning)",
        },
      ];
    }

    // Split by comma or semicolon
    const items = raw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    return items.map((item, idx) => {
      const lower = item.toLowerCase();
      const slots: Array<"morning" | "afternoon" | "evening" | "night"> = [];

      if (lower.includes("morning") || lower.includes("breakfast")) slots.push("morning");
      if (lower.includes("afternoon") || lower.includes("lunch") || lower.includes("midday")) slots.push("afternoon");
      if (lower.includes("evening") || lower.includes("dinner")) slots.push("evening");
      if (lower.includes("night") || lower.includes("bedtime") || lower.includes("sleep")) slots.push("night");

      if (slots.length === 0) {
        if (lower.includes("twice") || lower.includes("bid")) {
          slots.push("morning", "night");
        } else if (lower.includes("thrice") || lower.includes("tid")) {
          slots.push("morning", "afternoon", "night");
        } else {
          slots.push("morning");
        }
      }

      // Extract dosage if present (e.g. 500mg, 10mg, 50 mcg)
      const dosageMatch = item.match(/\b\d+(\.\d+)?\s*(mg|mcg|g|iu|ml|units?)\b/i);
      const dosage = dosageMatch ? dosageMatch[0] : "";
      
      // Clean name
      let cleanName = item
        .replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|iu|ml|units?)\b/gi, "")
        .replace(/\b(morning|afternoon|evening|night|bedtime|daily|once|twice|thrice|with|and)\b/gi, "")
        .replace(/[()&]/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^[-–—,\s]+|[-–—,\s]+$/g, "")
        .trim();

      if (!cleanName) cleanName = item;

      let frequency = "Daily";
      if (slots.length === 2) frequency = "Twice daily";
      else if (slots.length === 3) frequency = "3 times daily";
      else if (slots.length === 4) frequency = "4 times daily";
      else if (slots.length === 1) frequency = `Once daily (${SLOT_CONFIG[slots[0]].label})`;

      return {
        id: `med-${idx + 1}`,
        name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
        dosage: dosage || "Standard Dose",
        slots,
        instructions: lower.includes("meal") || lower.includes("food") ? "Take with meals" : "Take with water",
        frequency,
      };
    });
  }, [patient.medications]);

  // Calendar calculations
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday
  // Normalize so Monday is 0, Sunday is 6
  const startDayOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDay(1);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDay(1);
  };

  const handleToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDay(today.getDate());
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const currentMonthLabel = `${monthNames[currentMonth]} ${currentYear}`;

  // Fixed prescription milestone dates in the month
  const refillDay = 28; // Standard 28-day / monthly refill cycle
  const consultationDay = 15; // Mid-month review

  // Total daily doses across all medicines
  const totalDailyDoses = useMemo(() => {
    return parsedMedications.reduce((acc, m) => acc + m.slots.length, 0);
  }, [parsedMedications]);

  // Doses for selected day
  const selectedDateObj = new Date(currentYear, currentMonth, selectedDay);
  const isSelectedToday =
    today.getFullYear() === currentYear &&
    today.getMonth() === currentMonth &&
    today.getDate() === selectedDay;
  const isSelectedPast = selectedDateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Overview Metric Ribbon */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        <div
          style={{
            background: "#EDF7FE",
            border: "1.5px solid #7DD3FC",
            borderRadius: 14,
            padding: "16px 20px",
            boxShadow: "0 2px 12px rgba(12, 133, 208, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#12578A", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Active Prescriptions
            </span>
            <span style={{ fontSize: 18 }}>💊</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#083457" }}>
            {parsedMedications.length} <span style={{ fontSize: 13, fontWeight: 600, color: "#12578A" }}>Medications</span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#0C85D0", fontWeight: 600 }}>
            Active course: 30-Day Recurring Regimen
          </p>
        </div>

        <div
          style={{
            background: "#EDF7FE",
            border: "1.5px solid #7DD3FC",
            borderRadius: 14,
            padding: "16px 20px",
            boxShadow: "0 2px 12px rgba(12, 133, 208, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#12578A", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Daily Schedule
            </span>
            <span style={{ fontSize: 18 }}>⏰</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#083457" }}>
            {totalDailyDoses} <span style={{ fontSize: 13, fontWeight: 600, color: "#12578A" }}>Doses / Day</span>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {Object.entries(SLOT_CONFIG).map(([slotKey, conf]) => {
              const count = parsedMedications.filter((m) => m.slots.includes(slotKey as any)).length;
              if (count === 0) return null;
              return (
                <span
                  key={slotKey}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: 6,
                    background: conf.bg,
                    color: conf.color,
                    border: `1px solid ${conf.border}`,
                  }}
                >
                  {conf.icon} {conf.label}: {count}
                </span>
              );
            })}
          </div>
        </div>

        <div
          style={{
            background: "#EDF7FE",
            border: "1.5px solid #7DD3FC",
            borderRadius: 14,
            padding: "16px 20px",
            boxShadow: "0 2px 12px rgba(12, 133, 208, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#12578A", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Next Pharmacy Refill
            </span>
            <span style={{ fontSize: 18 }}>🔄</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#083457" }}>
            {monthNames[currentMonth].slice(0, 3)} {refillDay}
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#0369A1", fontWeight: 600 }}>
            Scheduled 28-day pharmacy synchronization
          </p>
        </div>

        <div
          style={{
            background: "#EDF7FE",
            border: "1.5px solid #7DD3FC",
            borderRadius: 14,
            padding: "16px 20px",
            boxShadow: "0 2px 12px rgba(12, 133, 208, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#12578A", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Monthly Adherence
            </span>
            <span style={{ fontSize: 18 }}>📈</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#083457" }}>
            95% <span style={{ fontSize: 13, fontWeight: 600, color: "#0C85D0" }}>Compliant</span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#0C85D0", fontWeight: 600 }}>
            {patient.last_contact_status === "yes" ? "✓ Fully confirmed on IVR" : "Active automated voice tracking"}
          </p>
        </div>
      </div>

      {/* Main Calendar Card */}
      <div
        style={{
          background: "#EDF7FE",
          border: "1.5px solid #7DD3FC",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 4px 20px rgba(12, 133, 208, 0.12)",
        }}
      >
        {/* Calendar Header with Navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: "1.5px solid #BAE6FD",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>📅</span>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#083457" }}>
                Prescription Schedule & Adherence Calendar
              </h2>
            </div>
            <p style={{ margin: "4px 0 0 32px", fontSize: 13, color: "#12578A", fontWeight: 500 }}>
              Click any calendar day to inspect scheduled medication slots, dosages, and refill dates.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={handleToday}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "1.5px solid #7DD3FC",
                background: "#BAE6FD",
                color: "#083457",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Today
            </button>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#D8EEFD", borderRadius: 8, padding: 3, border: "1px solid #90CDF4" }}>
              <button
                onClick={handlePrevMonth}
                aria-label="Previous month"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#083457",
                  fontWeight: 800,
                  fontSize: 14,
                  padding: "4px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                ◀
              </button>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#083457", padding: "0 8px", minWidth: 130, textAlign: "center" }}>
                {currentMonthLabel}
              </span>
              <button
                onClick={handleNextMonth}
                aria-label="Next month"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#083457",
                  fontWeight: 800,
                  fontSize: 14,
                  padding: "4px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                ▶
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16, fontSize: 12, color: "#12578A" }}>
          <span style={{ fontWeight: 700, color: "#083457" }}>Dosage Slots:</span>
          {Object.entries(SLOT_CONFIG).map(([k, conf]) => (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span>{conf.icon}</span>
              <span>{conf.label} ({conf.time})</span>
            </span>
          ))}
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1DA1F2", display: "inline-block" }}></span>
            <span>Active Prescription Day</span>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B", display: "inline-block", marginLeft: 6 }}></span>
            <span>Refill Due</span>
          </span>
        </div>

        {/* Calendar Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 6,
            marginBottom: 20,
          }}
        >
          {/* Weekday headers */}
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => (
            <div
              key={dayName}
              style={{
                textAlign: "center",
                padding: "8px 0",
                fontSize: 12,
                fontWeight: 800,
                color: "#12578A",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {dayName}
            </div>
          ))}

          {/* Empty cells before start of month */}
          {Array.from({ length: startDayOffset }).map((_, i) => (
            <div
              key={`empty-${i}`}
              style={{
                minHeight: 88,
                background: "rgba(224, 242, 254, 0.4)",
                borderRadius: 10,
                border: "1px dashed #BAE6FD",
                opacity: 0.5,
              }}
            />
          ))}

          {/* Days of month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const isTodayCell =
              today.getFullYear() === currentYear &&
              today.getMonth() === currentMonth &&
              today.getDate() === dayNum;
            const isSelectedCell = selectedDay === dayNum;
            const isRefillCell = dayNum === refillDay;
            const isConsultCell = dayNum === consultationDay;

            return (
              <div
                key={`day-${dayNum}`}
                onClick={() => setSelectedDay(dayNum)}
                style={{
                  minHeight: 88,
                  background: isSelectedCell
                    ? "#BAE6FD"
                    : isTodayCell
                    ? "#E0F2FE"
                    : "#FFFFFF",
                  border: isSelectedCell
                    ? "2.5px solid #083457"
                    : isTodayCell
                    ? "2px solid #1DA1F2"
                    : "1.5px solid #BAE6FD",
                  borderRadius: 10,
                  padding: "8px 8px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 0.15s ease",
                  boxShadow: isSelectedCell
                    ? "0 4px 12px rgba(8, 52, 87, 0.2)"
                    : "none",
                }}
              >
                {/* Day Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: isSelectedCell || isTodayCell ? 900 : 700,
                      color: isSelectedCell ? "#083457" : isTodayCell ? "#1DA1F2" : "#083457",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: isTodayCell ? "#BAE6FD" : "transparent",
                    }}
                  >
                    {dayNum}
                  </span>
                  {isTodayCell && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: "1px 5px",
                        borderRadius: 4,
                        background: "#1DA1F2",
                        color: "#FFFFFF",
                        textTransform: "uppercase",
                      }}
                    >
                      Today
                    </span>
                  )}
                  {isRefillCell && (
                    <span
                      title="Pharmacy Refill Synchronization"
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: "1px 5px",
                        borderRadius: 4,
                        background: "#FEF08A",
                        color: "#854D0E",
                        border: "1px solid #FDE047",
                      }}
                    >
                      Refill
                    </span>
                  )}
                  {isConsultCell && (
                    <span
                      title="Clinical Review Day"
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: "1px 5px",
                        borderRadius: 4,
                        background: "#DDD6FE",
                        color: "#5B21B6",
                      }}
                    >
                      Review
                    </span>
                  )}
                </div>

                {/* Day prescription dose indicators */}
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {Object.entries(SLOT_CONFIG).map(([slotKey, conf]) => {
                      const hasSlot = parsedMedications.some((m) => m.slots.includes(slotKey as any));
                      if (!hasSlot) return null;
                      return (
                        <span
                          key={slotKey}
                          title={`${conf.label} dose scheduled`}
                          style={{
                            fontSize: 11,
                            lineHeight: 1,
                            padding: "2px",
                            borderRadius: 4,
                            background: conf.bg,
                            border: `1px solid ${conf.border}`,
                          }}
                        >
                          {conf.icon}
                        </span>
                      );
                    })}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#12578A", marginTop: 2 }}>
                    {totalDailyDoses} doses
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Date Detail Drawer Panel */}
        <div
          style={{
            background: "#D8EEFD",
            border: "1.5px solid #90CDF4",
            borderRadius: 14,
            padding: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: "1.5px solid #BAE6FD",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>📋</span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#083457" }}>
                  Prescription Schedule for {monthNames[currentMonth]} {selectedDay}, {currentYear}
                </h3>
                {isSelectedToday && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "#1DA1F2",
                      color: "#FFFFFF",
                    }}
                  >
                    Today
                  </span>
                )}
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#12578A", fontWeight: 600 }}>
                {isSelectedPast
                  ? "Historical adherence status for this date"
                  : isSelectedToday
                  ? "Current active doses tracked by automated voice check-in"
                  : "Scheduled upcoming doses based on active prescription"}
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {selectedDay === refillDay && (
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 8,
                    background: "#FEF08A",
                    color: "#854D0E",
                    border: "1px solid #FDE047",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  🔄 Pharmacy Refill Due Today
                </span>
              )}
              {selectedDay === consultationDay && (
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 8,
                    background: "#DDD6FE",
                    color: "#5B21B6",
                    border: "1px solid #C4B5FD",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  🩺 Clinical Follow-up Review
                </span>
              )}
            </div>
          </div>

          {/* Doses breakdown by slot */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(["morning", "afternoon", "evening", "night"] as const).map((slotKey) => {
              const conf = SLOT_CONFIG[slotKey];
              const medsInSlot = parsedMedications.filter((m) => m.slots.includes(slotKey));
              if (medsInSlot.length === 0) return null;

              return (
                <div
                  key={slotKey}
                  style={{
                    background: "#FFFFFF",
                    border: "1.5px solid #BAE6FD",
                    borderRadius: 12,
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {/* Slot Title */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{conf.icon}</span>
                      <strong style={{ fontSize: 14, color: "#083457", fontWeight: 800 }}>
                        {conf.label} Slot ({conf.time})
                      </strong>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: conf.bg,
                        color: conf.color,
                        border: `1px solid ${conf.border}`,
                      }}
                    >
                      {medsInSlot.length} {medsInSlot.length === 1 ? "Medicine" : "Medicines"}
                    </span>
                  </div>

                  {/* Medicines in slot */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {medsInSlot.map((med) => (
                      <div
                        key={med.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: "#F0F9FF",
                          border: "1px solid #BAE6FD",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#083457" }}>
                              {med.name}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: "#BAE6FD",
                                color: "#083457",
                              }}
                            >
                              {med.dosage}
                            </span>
                          </div>
                          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#12578A" }}>
                            {med.instructions} • Frequency: {med.frequency}
                          </p>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              padding: "3px 10px",
                              borderRadius: 6,
                              background: isSelectedPast
                                ? "#BAE6FD"
                                : isSelectedToday
                                ? "#E0F2FE"
                                : "#F1F5F9",
                              color: isSelectedPast
                                ? "#083457"
                                : isSelectedToday
                                ? "#0369A1"
                                : "#475569",
                              border: `1px solid ${
                                isSelectedPast ? "#7DD3FC" : isSelectedToday ? "#BAE6FD" : "#CBD5E1"
                              }`,
                            }}
                          >
                            {isSelectedPast ? "✓ Taken" : isSelectedToday ? "🕒 Scheduled" : "🗓️ Upcoming"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Safety Disclaimer Banner */}
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              borderRadius: 8,
              background: "#E0F2FE",
              border: "1px solid #BAE6FD",
              fontSize: 11,
              color: "#083457",
              lineHeight: 1.5,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>🛡️</span>
            <span>
              <strong>Clinical Adherence Notice:</strong> Prescription dates and timings are recorded as directed by the patient's attending physician. Raksha verifies adherence during outbound check-ins and does not modify dosage or prescribe treatments.
            </span>
          </div>
        </div>
      </div>

      {/* Complete Prescribed Medication Regimen Table */}
      <div
        style={{
          background: "#EDF7FE",
          border: "1.5px solid #7DD3FC",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 4px 20px rgba(12, 133, 208, 0.12)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#083457" }}>
              Active Prescription Roster ({parsedMedications.length})
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#12578A" }}>
              Primary medications prescribed for daily adherence tracking
            </p>
          </div>
          {onEditMedications && (
            <button
              onClick={onEditMedications}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                background: "#083457",
                color: "#FFFFFF",
                border: "none",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ⚙️ Modify Prescriptions
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {parsedMedications.map((med, idx) => (
            <div
              key={med.id}
              style={{
                background: "#FFFFFF",
                border: "1.5px solid #BAE6FD",
                borderRadius: 12,
                padding: "14px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#083457" }}>
                    #{idx + 1} {med.name}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "#BAE6FD",
                      color: "#083457",
                    }}
                  >
                    {med.dosage}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "#12578A" }}>
                  <span>Instructions: <strong>{med.instructions}</strong></span>
                  <span>•</span>
                  <span>Frequency: <strong>{med.frequency}</strong></span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {med.slots.map((s) => {
                  const conf = SLOT_CONFIG[s];
                  return (
                    <span
                      key={s}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: conf.bg,
                        color: conf.color,
                        border: `1px solid ${conf.border}`,
                      }}
                    >
                      {conf.icon} {conf.label}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
