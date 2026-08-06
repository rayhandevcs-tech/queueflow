import type { BusinessType } from "@/types";
import { getStoredLanguage, type Language } from "@/lib/i18n";

/**
 * Vocabulary that changes with the kind of business.
 *
 * A salon has chairs and staff; a parlour has seats or beds and beauticians.
 * Those words were hardcoded across a dozen dictionaries, which meant launching
 * parlours would have been a find-and-replace through fifty files with no way
 * to tell a missed one from a deliberate one.
 *
 * This is the single place that mapping lives. It is deliberately small — only
 * the nouns that genuinely differ — because a general "translate everything by
 * business type" layer would be a second i18n system on top of the real one.
 */
export type TermKey =
  | "chair"
  | "chairs"
  | "staff"
  | "staffMember"
  | "venue"
  | "queueBoard";

type TermSet = Record<TermKey, { bn: string; en: string }>;

const SALON: TermSet = {
  chair: { bn: "চেয়ার", en: "Chair" },
  chairs: { bn: "চেয়ার ও স্টাফ", en: "Chairs & Staff" },
  staff: { bn: "স্টাফ", en: "Staff" },
  staffMember: { bn: "স্টাফ", en: "staff member" },
  venue: { bn: "সেলুন", en: "salon" },
  queueBoard: { bn: "লাইভ সিরিয়াল", en: "Live queue" },
};

const PARLOUR: TermSet = {
  chair: { bn: "সিট", en: "Seat" },
  chairs: { bn: "সিট ও বিউটিশিয়ান", en: "Seats & Beauticians" },
  staff: { bn: "বিউটিশিয়ান", en: "Beauticians" },
  staffMember: { bn: "বিউটিশিয়ান", en: "beautician" },
  venue: { bn: "পার্লার", en: "parlour" },
  queueBoard: { bn: "লাইভ সিরিয়াল", en: "Live queue" },
};

/** UNISEX shops read as salons — that's the flow they actually run today. */
function setFor(type: BusinessType | null | undefined): TermSet {
  return type === "PARLOUR" ? PARLOUR : SALON;
}

/** Outside a component (api/module scope), same rule as `translate()`. */
export function term(
  key: TermKey,
  type: BusinessType | null | undefined,
  lang: Language = getStoredLanguage(),
): string {
  return setFor(type)[key][lang];
}

/**
 * Hook form — returns a resolver bound to one shop's type, so a component
 * reads `tt("chair")` the same way it reads `t("someKey")`.
 *
 * Not a `useT`-style hook of its own: language already re-renders through the
 * i18n provider, and taking the language as an argument keeps this callable
 * from anywhere without a second context.
 */
export function useTerms(type: BusinessType | null | undefined, lang: Language) {
  return (key: TermKey) => setFor(type)[key][lang];
}
