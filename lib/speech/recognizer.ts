const DEFAULT_LANG = process.env.NEXT_PUBLIC_SPEECH_LANG ?? "en-IN";

/* eslint-disable @typescript-eslint/no-explicit-any */
type RecognitionLike = any;

function getRecognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function speechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export type ListenOptions = {
  lang?: string;
  /** Silence after last interim result that ends the utterance. */
  silenceMs?: number;
  /** Hard timeout with no speech at all. */
  timeoutMs?: number;
  /** Abort when this returns true (hang up). */
  shouldAbort?: () => boolean;
  onInterim?: (text: string) => void;
};

/**
 * One recognition pass. Chrome auto-stops; we restart per turn.
 * Returns final transcript, or null on no-speech / timeout / abort / unsupported.
 */
export function listenOnce(opts?: ListenOptions): Promise<string | null> {
  const lang = opts?.lang ?? DEFAULT_LANG;
  const silenceMs = opts?.silenceMs ?? 1200;
  const timeoutMs = opts?.timeoutMs ?? 10_000;

  return new Promise((resolve) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      resolve(null);
      return;
    }

    let settled = false;
    let rec: RecognitionLike;
    try {
      rec = new Ctor();
    } catch {
      resolve(null);
      return;
    }

    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let hardTimer: ReturnType<typeof setTimeout> | null = null;
    let lastInterim = "";

    const cleanup = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (hardTimer) clearTimeout(hardTimer);
      try {
        rec.onend = null;
        rec.onerror = null;
        rec.onresult = null;
        rec.abort();
      } catch {
        // ignore
      }
    };

    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const bumpSilence = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        finish(lastInterim.trim() || null);
      }, silenceMs);
    };

    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      if (opts?.shouldAbort?.()) {
        finish(null);
        return;
      }
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const txt = res[0]?.transcript ?? "";
        if (res.isFinal) final += txt;
        else interim += txt;
      }
      const chunk = (final || interim).trim();
      if (chunk) {
        lastInterim = chunk;
        opts?.onInterim?.(chunk);
        bumpSilence();
      }
      if (final.trim()) {
        finish(final.trim());
      }
    };

    rec.onerror = (event: any) => {
      const code = event?.error;
      if (code === "aborted" || code === "not-allowed" || code === "service-not-allowed") {
        finish(null);
        return;
      }
      // "no-speech" / "network" → treat as no utterance this turn
      finish(null);
    };

    rec.onend = () => {
      if (settled) return;
      finish(lastInterim.trim() || null);
    };

    hardTimer = setTimeout(() => {
      finish(null);
    }, timeoutMs);

    try {
      rec.start();
      // Do NOT call bumpSilence() here — wait for first speech result.
      // Starting the timer immediately caused the listen window to close
      // before Chrome could capture any audio.
    } catch {
      finish(null);
    }
  });
}
