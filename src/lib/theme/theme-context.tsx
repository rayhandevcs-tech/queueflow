"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getStoredTheme, setStoredTheme } from "./storage";
import { DEFAULT_THEME, type Theme } from "./types";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * One theme state for the whole application.
 *
 * It sits at the root layout, above the customer shell, the provider shell,
 * the admin shell and every page, so there is exactly one answer to "which
 * theme is on" — and changing it writes one attribute on `<html>`, which is
 * what actually repaints everything. No component subscribes to this in order
 * to pick a colour; they all keep using `bg-card`, `text-ink`, `border-line`
 * and get themed for free.
 *
 * Only the handful of components that let you CHOOSE a theme read the context.
 * That matters for the re-render cost too: switching themes re-renders the
 * theme switcher and nothing else, because the repaint happens in CSS.
 *
 * The state starts at the default and syncs from storage after mount — the
 * same hydration-safe shape `LanguageProvider` uses. The pre-paint script in
 * `<head>` has already set the attribute by then, so there is no flash: this
 * effect only brings React's copy of the value in line with the DOM's.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(getStoredTheme());
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = (next: Theme) => {
    setStoredTheme(next);
    setThemeState(next);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
