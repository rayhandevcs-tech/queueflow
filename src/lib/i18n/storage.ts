import type { Language } from "./types";

const LANG_KEY = "smartsailor_lang";
/** Pre-rebrand key — read once so nobody's language choice resets on deploy. */
const LEGACY_LANG_KEY = "queueflow_lang";

export function getStoredLanguage(): Language {
  if (typeof window === "undefined") return "bn";
  const v =
    window.localStorage.getItem(LANG_KEY) ?? window.localStorage.getItem(LEGACY_LANG_KEY);
  return v === "en" ? "en" : "bn";
}

export function setStoredLanguage(lang: Language): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANG_KEY, lang);
}
