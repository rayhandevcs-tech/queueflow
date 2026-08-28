"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Minimal typings for the Web Speech API.
 *
 * It is still prefixed and absent from lib.dom, so these describe only the
 * handful of members used here rather than pulling in a dependency for a
 * browser API we touch in one file.
 */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const NO_SUBSCRIBE = () => () => {};

export type DictationError = "denied" | "no-speech" | "unsupported" | "failed";

/**
 * Bangla dictation, using the browser's own speech recognition.
 *
 * Chosen over a speech-to-text API for three reasons that all matter here: it
 * costs nothing per use, it needs no second vendor and no second key, and the
 * audio never becomes a file we hold — the browser streams it and hands back
 * text. For a shopkeeper speaking a dozen times a day, a paid transcription
 * call each time would quietly become the app's largest running cost.
 *
 * The trade is coverage: this is Chrome, Edge and Samsung Internet, plus recent
 * Safari. On anything else `supported` is false and the caller shows the normal
 * typed flow instead of a broken button.
 */
export function useDictation(lang = "bn-BD") {
  // useSyncExternalStore rather than an effect: this is a browser capability
  // read, and the server snapshot of `false` is what prevents a hydration
  // mismatch between "no window, assume unsupported" and what the browser
  // actually has. The subscribe function is a no-op because the answer cannot
  // change after load.
  const supported = useSyncExternalStore(
    NO_SUBSCRIBE,
    () => getRecognitionCtor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<DictationError | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    // Recognition holds the microphone open; leaving it running after the
    // component goes away keeps the browser's recording indicator lit.
    return () => recognitionRef.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("unsupported");
      return;
    }

    recognitionRef.current?.abort();
    setTranscript("");
    setError(null);

    const recognition = new Ctor();
    recognition.lang = lang;
    // Continuous: a shopkeeper pauses mid-sentence to look at a chair, and the
    // single-shot mode cuts them off at the first silence.
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text.trim());
    };

    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "denied"
          : event.error === "no-speech"
            ? "no-speech"
            : "failed",
      );
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start() throws if called while already running — treat as a no-op
      // rather than surfacing an error the user cannot act on.
      setListening(false);
    }
  }, [lang]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setTranscript("");
    setError(null);
    setListening(false);
  }, []);

  return { supported, listening, transcript, error, start, stop, reset };
}
