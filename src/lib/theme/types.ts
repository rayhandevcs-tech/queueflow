/**
 * The four palettes, named by their brand colour.
 *
 * `"red"` is the original Signature theme and stays the default — an existing
 * user who never touches the switch sees exactly the app they had.
 *
 * These strings are the `data-theme` attribute values on `<html>` and the
 * `[data-theme="…"]` selectors in `globals.css`. Three places have to agree,
 * so the list lives here and the other two are derived from it.
 */
export const THEMES = ["red", "black", "green", "blue"] as const;

export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "red";

/**
 * Read an unknown value as a theme, falling back to the default.
 *
 * Everything that reaches this is untrusted: a `localStorage` value from an
 * older deploy, a hand-edited attribute, a renamed theme. A bad value has to
 * become the default rather than an empty palette, because an unrecognised
 * `data-theme` would leave the page with no colours at all.
 */
export function parseTheme(value: unknown): Theme {
  return (THEMES as readonly string[]).includes(value as string)
    ? (value as Theme)
    : DEFAULT_THEME;
}
