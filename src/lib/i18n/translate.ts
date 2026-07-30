import { useLanguage } from "./language-context";
import { getStoredLanguage } from "./storage";
import type { Dict, Language } from "./types";

function resolveEntry(entry: Dict[string][Language], args: unknown[]): string {
  return typeof entry === "function"
    ? (entry as (...a: unknown[]) => string)(...args)
    : entry;
}

/** Component hook: `const t = useT(dict); t("title")`. Re-renders when language changes. */
export function useT<T extends Dict>(dict: T) {
  const { language } = useLanguage();
  return function t<K extends keyof T & string>(key: K, ...args: unknown[]): string {
    return resolveEntry(dict[key][language], args);
  };
}

/** Non-component usage (zod schemas, api/db-error mappers) — reads current language from storage. */
export function translate<T extends Dict, K extends keyof T & string>(
  dict: T,
  key: K,
  ...args: unknown[]
): string {
  const lang = getStoredLanguage();
  return resolveEntry(dict[key][lang], args);
}

/** Same as `translate`, but takes an explicit language — for zod schema factories called from `useMemo(() => schema(language), [language])`. */
export function resolveDict<T extends Dict, K extends keyof T & string>(
  dict: T,
  lang: Language,
  key: K,
  ...args: unknown[]
): string {
  return resolveEntry(dict[key][lang], args);
}
