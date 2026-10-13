export type CallType = "morning" | "evening" | "followup" | "retry";

export type CallTransportContext = {
  callType: CallType | string;
  context: string;
  attempt: number;
};

export interface CallTransport {
  ring(callId: string, ctx: CallTransportContext): void;
  onAnswered(cb: () => void): void;
  onRingTimeout(cb: () => void): void;
  /** Resolves when finished speaking. */
  speak(text: string): Promise<void>;
  /** Resolves with final transcript, or null on no speech / timeout / abort. */
  listen(opts?: { silenceMs?: number; timeoutMs?: number }): Promise<string | null>;
  hangup(): void;
}

export type TranscriptEntry = {
  role: "ai" | "grandma";
  text: string;
  ts: number;
};

export type TurnResponse = {
  reply: string;
  end_call: boolean;
  emergency: boolean;
  source?: "n8n" | "fallback";
};
