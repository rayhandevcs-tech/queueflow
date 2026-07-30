export type Language = "bn" | "en";

/** A translated value: either a plain string or a function for interpolated/pluralized text. */
export type Entry = string | ((...args: never[]) => string);

export type Dict = Record<string, Record<Language, Entry>>;
