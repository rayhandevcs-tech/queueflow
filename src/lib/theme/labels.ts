import type { Dict } from "@/lib/i18n";
import type { Theme } from "./types";

/**
 * What each theme is called, in both languages.
 *
 * Named by colour rather than by mood ("Classic", "Midnight", "Forest"): a
 * shopkeeper picking a theme wants to know what they are going to get, and
 * "লাল" answers that in one word where "ক্লাসিক" does not.
 */
export const THEME_LABEL = {
  red: { bn: "লাল", en: "Red" },
  black: { bn: "কালো", en: "Black" },
  green: { bn: "সবুজ", en: "Green" },
  blue: { bn: "নীল", en: "Blue" },
} satisfies Dict;

/**
 * The colour a swatch shows for each theme, for the switcher only.
 *
 * Hard-coded rather than read from the CSS variables on purpose: a swatch has
 * to show the theme it would switch TO, and `var(--qf-accent)` is always the
 * theme that is currently ON. These four values are the `--qf-accent` of each
 * palette in `globals.css` — the one place in the app where a colour is
 * written twice, and it is commented in both.
 */
export const THEME_SWATCH: Record<Theme, string> = {
  red: "#c43f3f",
  black: "#1b1d22",
  green: "#15803d",
  blue: "#1d4ed8",
};
