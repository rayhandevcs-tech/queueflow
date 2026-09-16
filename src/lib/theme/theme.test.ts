import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEMES, parseTheme, type Theme } from "./types";
import { THEME_LABEL, THEME_SWATCH } from "./labels";
import { THEME_INIT_SCRIPT, getStoredTheme } from "./storage";

describe("the theme list", () => {
  it("is the four the sprint asked for, red first", () => {
    expect(THEMES).toEqual(["red", "black", "green", "blue"]);
  });

  it("**defaults to red** — an existing user sees the app they had", () => {
    expect(DEFAULT_THEME).toBe("red");
    expect(THEMES[0]).toBe(DEFAULT_THEME);
  });
});

describe("parseTheme", () => {
  it("accepts every theme name", () => {
    for (const theme of THEMES) expect(parseTheme(theme)).toBe(theme);
  });

  it("**falls back to the default for anything else**", () => {
    // An unrecognised `data-theme` would leave the page with no palette at
    // all, so there is no such thing as an unknown theme downstream of here.
    expect(parseTheme(null)).toBe(DEFAULT_THEME);
    expect(parseTheme(undefined)).toBe(DEFAULT_THEME);
    expect(parseTheme("")).toBe(DEFAULT_THEME);
    expect(parseTheme("purple")).toBe(DEFAULT_THEME);
    expect(parseTheme("RED")).toBe(DEFAULT_THEME);
    expect(parseTheme(7)).toBe(DEFAULT_THEME);
    expect(parseTheme({})).toBe(DEFAULT_THEME);
  });
});

describe("every theme is fully described", () => {
  it("has a label in both languages", () => {
    for (const theme of THEMES) {
      expect(THEME_LABEL[theme]?.bn, theme).toBeTruthy();
      expect(THEME_LABEL[theme]?.en, theme).toBeTruthy();
    }
  });

  it("has a swatch colour", () => {
    for (const theme of THEMES) {
      expect(THEME_SWATCH[theme], theme).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("has four distinct swatches, so the switcher is readable", () => {
    expect(new Set(Object.values(THEME_SWATCH)).size).toBe(THEMES.length);
  });

  it("carries no label or swatch for a theme that does not exist", () => {
    expect(Object.keys(THEME_SWATCH).sort()).toEqual([...THEMES].sort());
    expect(Object.keys(THEME_LABEL).sort()).toEqual([...THEMES].sort());
  });
});

describe("the pre-paint init script", () => {
  it("**names every theme** — one missing would silently not persist", () => {
    // The script runs before React and cannot import anything, so the four
    // names are written into it by hand. This is the test that catches a
    // fifth theme being added to THEMES and forgotten here: the symptom
    // otherwise is one theme that mysteriously resets on every reload.
    for (const theme of THEMES) {
      expect(THEME_INIT_SCRIPT, theme).toContain(`"${theme}"`);
    }
  });

  it("reads the same storage key the app writes", () => {
    expect(THEME_INIT_SCRIPT).toContain("smartsailor_theme");
  });

  it("sets data-theme on the document element", () => {
    expect(THEME_INIT_SCRIPT).toContain('setAttribute("data-theme"');
  });

  it("**is wrapped in try/catch** — it runs before React, so a throw is fatal", () => {
    expect(THEME_INIT_SCRIPT).toContain("try{");
    expect(THEME_INIT_SCRIPT).toContain("catch");
  });

  it("closes no script tag and needs no escaping", () => {
    expect(THEME_INIT_SCRIPT).not.toContain("</script");
    expect(THEME_INIT_SCRIPT).not.toContain("<!--");
  });
});

describe("getStoredTheme without a browser", () => {
  it("returns the default rather than throwing during SSR", () => {
    // The test environment is node, so `window` is genuinely undefined here —
    // the same condition every server render is in.
    expect(getStoredTheme()).toBe(DEFAULT_THEME);
  });
});

describe("the CSS contract", () => {
  it("every theme name is a valid CSS attribute value", () => {
    // They end up inside `[data-theme="…"]` selectors, so anything needing
    // escaping would silently never match.
    for (const theme of THEMES as readonly Theme[]) {
      expect(theme).toMatch(/^[a-z]+$/);
    }
  });
});
