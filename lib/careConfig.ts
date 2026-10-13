export const CARE_CONFIG = {
  /** Pause after TTS finishes before the mic opens (AI → Grandma). */
  postSpeakGapMs: Number(process.env.NEXT_PUBLIC_POST_SPEAK_GAP_MS ?? 500),
  /** Extra settle after speechSynthesis onend (Chrome often ends early). */
  speakSettleMs: Number(process.env.NEXT_PUBLIC_SPEAK_SETTLE_MS ?? 350),
  /** Silence after last interim that ends Grandma's turn. */
  utteranceEndSilenceMs: Number(
    process.env.NEXT_PUBLIC_UTTERANCE_END_SILENCE_MS ?? 1500,
  ),
  /** Hard timeout with no speech at all. */
  listenTimeoutMs: Number(process.env.NEXT_PUBLIC_LISTEN_TIMEOUT_MS ?? 12_000),
  maxCallTurns: Number(process.env.NEXT_PUBLIC_MAX_CALL_TURNS ?? 8),
  speechLang: process.env.NEXT_PUBLIC_SPEECH_LANG ?? "en-IN",
} as const;

export function delay(ms: number, signal?: { aborted: boolean }): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const check = setInterval(() => {
        if (signal.aborted) {
          clearTimeout(t);
          clearInterval(check);
          resolve();
        }
      }, 50);
      // clear interval when timeout fires
      setTimeout(() => clearInterval(check), ms + 20);
    }
  });
}
