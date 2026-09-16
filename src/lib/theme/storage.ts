import { DEFAULT_THEME, parseTheme, type Theme } from "./types";

/**
 * Where the choice lives: this browser, and nowhere else.
 *
 * Deliberately not a column on `profiles`. A colour scheme is a property of
 * the screen you are looking at, not of your account — the same shopkeeper
 * wants the dark-ink theme on the counter tablet under shop lights and may
 * want something else on their phone. Storing it server-side would also mean
 * a database round trip before the first paint, which is exactly how a theme
 * flash gets built in.
 *
 * Same mechanism, same shape and the same key convention as the language
 * preference (`src/lib/i18n/storage.ts`), so there is one persistence story in
 * the app rather than two.
 */
const THEME_KEY = "smartsailor_theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    return parseTheme(window.localStorage.getItem(THEME_KEY));
  } catch {
    // Private mode and blocked site-data both throw on access. A theme is not
    // worth a crashed render.
    return DEFAULT_THEME;
  }
}

export function setStoredTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Nothing to do: the theme still applies for this session, it just will
    // not survive a reload.
  }
}

/**
 * The script that runs before the first paint.
 *
 * Without it the server's HTML (always the default theme) would paint, and the
 * stored theme would then be applied on hydration — a visible flash of red on
 * every single page load for anyone who chose otherwise. It is inlined into
 * `<head>` and deliberately tiny, dependency-free and wrapped in a try/catch:
 * it runs before React, so anything it throws takes the page with it.
 *
 * It is exported as a string from here rather than written inline in the
 * layout so the storage key is defined once.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});if(t==="red"||t==="black"||t==="green"||t==="blue")document.documentElement.setAttribute("data-theme",t);}catch(e){}`;
