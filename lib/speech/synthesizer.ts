import { CARE_CONFIG, delay } from "@/lib/careConfig";

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const langKeys = [lang, "en-IN", "en-GB", "en-US", "en"];
  for (const key of langKeys) {
    const exact = voices.filter((v) => v.lang?.replace("_", "-") === key);
    const female = exact.find((v) =>
      /female|heera|neerja|priya|samantha|karen|serena|zira|susan|libby|google uk english female/i.test(
        `${v.name} ${v.lang}`,
      ),
    );
    if (female) return female;
    if (exact[0]) return exact[0];
  }

  const english = voices.find((v) => v.lang?.toLowerCase().startsWith("en"));
  return english ?? voices[0] ?? null;
}

/** Cache voice list once voices load (Chrome loads async). */
export function warmVoices(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

export function stopSpeaking(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

/**
 * Speak aloud and resolve only after audio is likely finished
 * (onend + settle). Callers must not open the mic until this resolves.
 */
export function speak(
  text: string,
  opts?: { lang?: string; signal?: { aborted: boolean } },
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) {
      resolve();
      return;
    }

    const lang = opts?.lang ?? CARE_CONFIG.speechLang;
    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(lang);
    if (voice) utter.voice = voice;
    utter.lang = voice?.lang || lang;
    utter.rate = 0.92;
    utter.pitch = 1.04;

    let settled = false;
    const done = async () => {
      if (settled) return;
      settled = true;
      // Chrome onend often fires before audio fully stops.
      await delay(CARE_CONFIG.speakSettleMs, opts?.signal);
      resolve();
    };

    // Safety: never hang the call on a stuck synthesis event.
    const maxMs = Math.min(25_000, 2000 + text.length * 90);
    const timer = setTimeout(() => {
      void done();
    }, maxMs);

    utter.onend = () => {
      clearTimeout(timer);
      void done();
    };
    utter.onerror = () => {
      clearTimeout(timer);
      void done();
    };

    try {
      window.speechSynthesis.cancel();
      // Chrome sometimes needs resume after cancel.
      window.speechSynthesis.resume();
    } catch {
      // ignore
    }
    window.speechSynthesis.speak(utter);
  });
}
