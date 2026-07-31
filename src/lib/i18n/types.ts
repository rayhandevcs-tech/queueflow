export type Language = "bn" | "en";

/** Every supported language, in the order UI switchers should list them. */
export const LANGUAGES: readonly Language[] = ["bn", "en"];

/** A translated value: either a plain string or a function for interpolated/pluralized text. */
export type Entry = string | ((...args: never[]) => string);

export type Dict = Record<string, Record<Language, Entry>>;
