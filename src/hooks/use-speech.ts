"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Reading an answer out loud, using the browser's own speech synthesis.
 *
 * ---------------------------------------------------------------------------
 * Why the browser and not a voice API
 * ---------------------------------------------------------------------------
 * Same reasoning as `use-dictation`, and it matters more here because output is
 * the side that gets used repeatedly: a shopkeeper who asks the assistant four
 * questions during a shift would be four paid synthesis calls, every shift,
 * forever. `speechSynthesis` costs nothing, needs no second vendor and no
 * second key, and the text never leaves the device.
 *
 * The trade is voice quality and Bangla coverage, which is genuinely uneven —
 * see the note on `pickVoice` below. That is why this is a button the person
 * presses rather than something that speaks on its own.
 *
 * ---------------------------------------------------------------------------
 * One utterance at a time, keyed by id
 * ---------------------------------------------------------------------------
 * `speakingId` is the id of whatever is being read, or null. A chat has several
 * answers on screen and the caller needs to know *which* button should show a
 * stop icon — a plain boolean would light up all of them. Starting a second
 * utterance cancels the first, because `speechSynthesis` otherwise queues them
 * and the person hears two answers back to back with no way to tell why.
 */

const NO_SUBSCRIBE = () => () => {};

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

/**
 * The best available voice for a language, or null to let the browser decide.
 *
 * `getVoices()` is populated asynchronously and is frequently empty on the
 * first call, which is why this runs at speak time rather than on mount — by
 * the time someone has read an answer and pressed a button, the list is there.
 * If it still is not, returning null is correct: setting `utterance.lang` alone
 * makes the browser pick something reasonable, and a wrong voice is better than
 * silence.
 *
 * Matched on the language prefix (`bn`) rather than the full tag, because a
 * device may carry `bn-IN` and not `bn-BD`, and for reading a sentence aloud
 * that difference is an accent rather than a comprehension problem.
 */
function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const prefix = lang.split("-")[0].toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ??
    null
  );
}

export function useSpeech(lang = "bn-BD") {
  // Same pattern as `use-dictation`: a browser-capability read through
  // useSyncExternalStore, whose server snapshot of `false` is what keeps
  // hydration from mismatching. The answer cannot change after load, so
  // subscribe is a no-op.
  const supported = useSyncExternalStore(
    NO_SUBSCRIBE,
    () => synth() !== null,
    () => false,
  );

  const [speakingId, setSpeakingId] = useState<string | null>(null);
  // Held so `stop` and the unmount cleanup can cancel without depending on
  // state, which would make them change identity on every utterance.
  const activeRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Synthesis is a property of the *window*, not of this component: without
    // this, closing the chat panel mid-sentence leaves the phone talking to
    // nobody, and there is no longer a button to stop it.
    return () => {
      activeRef.current = null;
      synth()?.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    activeRef.current = null;
    synth()?.cancel();
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    (id: string, text: string) => {
      const s = synth();
      const body = text.trim();
      if (!s || !body) return;

      // Cancel first, always. Chrome in particular will queue an utterance
      // behind a cancelled one and start speaking again a beat later.
      s.cancel();

      const utterance = new SpeechSynthesisUtterance(body);
      utterance.lang = lang;
      const voice = pickVoice(s.getVoices(), lang);
      if (voice) utterance.voice = voice;
      // A shade under default: the assistant answers in Bangla with numbers in
      // it, and figures read at full speed are the part people ask to repeat.
      utterance.rate = 0.95;

      utterance.onend = () => {
        if (activeRef.current === utterance) {
          activeRef.current = null;
          setSpeakingId(null);
        }
      };
      // Treated exactly like a normal end. The common causes are a missing
      // voice for the language and a cancel racing the start, and in both the
      // honest UI is a button that has stopped rather than an error about a
      // feature nobody asked to be reliable.
      utterance.onerror = utterance.onend;

      activeRef.current = utterance;
      setSpeakingId(id);
      s.speak(utterance);
    },
    [lang],
  );

  /** `speak` if this id is idle, `stop` if it is the one already talking. */
  const toggle = useCallback(
    (id: string, text: string) => {
      if (speakingId === id) stop();
      else speak(id, text);
    },
    [speakingId, speak, stop],
  );

  return { supported, speakingId, speak, stop, toggle };
}
