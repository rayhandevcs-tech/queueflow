export type { Language, Entry, Dict } from "./types";
export { LanguageProvider, useLanguage } from "./language-context";
export { useT, translate, resolveDict } from "./translate";
export { getStoredLanguage, setStoredLanguage } from "./storage";
