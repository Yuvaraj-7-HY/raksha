export type CallStatus = "idle" | "ringing" | "in_call";

export type RingState = {
  status: CallStatus;
  callId: string | null;
  callType: string | null;
  context: string | null;
  attempt: number;
  ringStartedAt: number | null;
  patientName: string;
};

export type PhoneStateResponse = {
  status: CallStatus;
  callId?: string;
  callType?: string;
  context?: string;
  attempt?: number;
  patientName: string;
  ringAgeSeconds?: number;
};

const PATIENT_NAME = "Grandma";

type GlobalWithRing = typeof globalThis & {
  __careRingState?: RingState;
};

function getState(): RingState {
  const g = globalThis as GlobalWithRing;
  if (!g.__careRingState) {
    g.__careRingState = {
      status: "idle",
      callId: null,
      callType: null,
      context: null,
      attempt: 0,
      ringStartedAt: null,
      patientName: PATIENT_NAME,
    };
  }
  return g.__careRingState;
}

function isBusy(status: CallStatus): boolean {
  return status === "ringing" || status === "in_call";
}

export function readRingState(): PhoneStateResponse {
  const s = getState();
  const base: PhoneStateResponse = {
    status: s.status,
    patientName: s.patientName,
  };
  if (s.status === "idle") return base;

  return {
    ...base,
    callId: s.callId ?? undefined,
    callType: s.callType ?? undefined,
    context: s.context ?? undefined,
    attempt: s.attempt,
    ringAgeSeconds:
      s.ringStartedAt != null
        ? Math.floor((Date.now() - s.ringStartedAt) / 1000)
        : 0,
  };
}

export function tryStartRing(input: {
  callId: string;
  callType: string;
  context: string;
  attempt: number;
}): { ok: true; state: PhoneStateResponse } | { ok: false; status: 409 } {
  const s = getState();
  if (isBusy(s.status)) {
    return { ok: false, status: 409 };
  }
  s.status = "ringing";
  s.callId = input.callId;
  s.callType = input.callType;
  s.context = input.context;
  s.attempt = input.attempt;
  s.ringStartedAt = Date.now();
  return { ok: true, state: readRingState() };
}

export function acceptCall(callId: string): { ok: boolean; status: number } {
  const s = getState();
  if (s.status !== "ringing" || s.callId !== callId) {
    return { ok: false, status: 409 };
  }
  s.status = "in_call";
  s.ringStartedAt = null;
  return { ok: true, status: 200 };
}

export function endCall(callId?: string): void {
  const s = getState();
  if (callId && s.callId && s.callId !== callId) return;
  s.status = "idle";
  s.callId = null;
  s.callType = null;
  s.context = null;
  s.attempt = 0;
  s.ringStartedAt = null;
}
