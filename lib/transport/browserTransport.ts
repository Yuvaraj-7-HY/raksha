import { CARE_CONFIG, delay } from "@/lib/careConfig";
import { listenOnce } from "@/lib/speech/recognizer";
import { speak as synthSpeak, stopSpeaking } from "@/lib/speech/synthesizer";
import type { CallTransport } from "./types";

/**
 * Browser Web Speech implementation of CallTransport.
 * Ring UI is handled by the phone page; this owns voice in/out.
 *
 * After AI speech we deliberately pause before opening the mic
 * (POST_SPEAK_GAP) so Grandma is not interrupted.
 */
export class BrowserTransport implements CallTransport {
  private hungUp = false;
  private ringTimer: ReturnType<typeof setTimeout> | null = null;
  private voiceSignal = { aborted: false };

  ring(): void {
    this.hungUp = false;
    this.voiceSignal = { aborted: false };
  }

  onAnswered(): void {}
  onRingTimeout(): void {}

  async speak(text: string): Promise<void> {
    if (this.hungUp) return;
    await synthSpeak(text, { signal: this.voiceSignal });
    if (this.hungUp) return;
    // Gap after assistant finishes — Grandma's turn starts here.
    await delay(CARE_CONFIG.postSpeakGapMs, this.voiceSignal);
  }

  async listen(opts?: {
    silenceMs?: number;
    timeoutMs?: number;
    onInterim?: (t: string) => void;
  }): Promise<string | null> {
    if (this.hungUp) return null;
    return listenOnce({
      lang: CARE_CONFIG.speechLang,
      silenceMs: opts?.silenceMs ?? CARE_CONFIG.utteranceEndSilenceMs,
      timeoutMs: opts?.timeoutMs ?? CARE_CONFIG.listenTimeoutMs,
      onInterim: opts?.onInterim,
      shouldAbort: () => this.hungUp || this.voiceSignal.aborted,
    });
  }

  hangup(): void {
    this.hungUp = true;
    this.voiceSignal.aborted = true;
    if (this.ringTimer) clearTimeout(this.ringTimer);
    stopSpeaking();
  }
}

export const browserTransport = new BrowserTransport();
