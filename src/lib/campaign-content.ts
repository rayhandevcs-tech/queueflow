/**
 * Campaign text: the bounds, and the guard against an offer nobody configured.
 *
 * ---------------------------------------------------------------------------
 * The problem this solves
 * ---------------------------------------------------------------------------
 * §9 of the sprint brief: "If the owner asks 'Give them 20% discount' but the
 * shop has no configured 20% offer, the AI must not silently invent one."
 *
 * That is not a hypothetical failure mode, it is the likeliest one. A model
 * asked to write marketing copy will reach for a discount, because that is what
 * marketing copy contains — and a notification promising 20% off, sent to
 * forty-three people, is a promise the shop has to either honour or break.
 * Breaking it is the shop's reputation; honouring it is the shop's money. Both
 * are real, and neither is recoverable by deleting a row.
 *
 * ---------------------------------------------------------------------------
 * Where the guard applies, and where it deliberately does not
 * ---------------------------------------------------------------------------
 * It applies to text the MODEL drafted, inside `prepare_campaign`, so an
 * invented offer never becomes a card the owner might approve without reading.
 *
 * It does NOT apply to text the OWNER typed. §9 says campaign content must be
 * "based only on verified business facts or explicitly owner-provided text",
 * and the owner is the business: they are entitled to promise a discount they
 * have not yet entered into the app, and a system that refused them would be
 * wrong about who is in charge. The confirm endpoint validates an owner's edit
 * for shape and length, not for generosity.
 *
 * That distinction is the whole design, and it is why the check lives in a pure
 * module rather than inside the send: the caller decides which kind of text it
 * is holding, because only the caller knows.
 *
 * ---------------------------------------------------------------------------
 * What it catches, and what it honestly cannot
 * ---------------------------------------------------------------------------
 * CATCHES: a numeric claim with no matching configured fact. "২০% ছাড়" when no
 * active offer or reward is 20%. "৩০০ টাকা ছাড়" when nothing costs or
 * discounts 300. "ফ্রি ফেসিয়াল" when no FREE_SERVICE reward exists.
 *
 * CANNOT CATCH: a promise with no number in it. "তোমার জন্য বিশেষ ব্যবস্থা"
 * ("something special for you") is vague, unverifiable and not refused here.
 * Nor can it verify a claimed expiry date, because "this week only" is not a
 * figure to compare against anything.
 *
 * Those gaps are covered by the two things that are not code: the system prompt
 * forbids them explicitly, and the owner reads the message before approving it.
 * Stating the gap is the point — a guard whose limits are undocumented gets
 * trusted for things it does not do.
 */

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

/**
 * Mirrored from `ai_actions_campaign_bounds` in 20261002, and from
 * `ai_action_apply_campaign_edit`, both of which check the same numbers.
 *
 * The title is what a notification shows in a list, so eighty characters is
 * already more than a phone renders. The body is a push notification, not an
 * email: five hundred characters is generous for something read on a lock
 * screen, and a longer one would be truncated by the platform rather than by
 * this product, which is worse because it truncates unpredictably.
 */
export const CAMPAIGN_TITLE_MAX = 80;
export const CAMPAIGN_BODY_MAX = 500;

// ---------------------------------------------------------------------------
// Digits
// ---------------------------------------------------------------------------

/**
 * Bengali digits to Western ones.
 *
 * Necessary rather than decorative: this product writes every number in
 * Bengali digits, the prompt tells the model to do the same, and a regex
 * looking for `\d` would find nothing at all in "২০% ছাড়" — which would make
 * the entire guard silently vacuous against exactly the text it exists to
 * check. That failure mode is invisible in a passing test suite unless the
 * test uses Bengali digits, so the tests do.
 */
export function toWesternDigits(text: string): string {
  return text.replace(/[০-৯]/g, (d) =>
    String(d.charCodeAt(0) - 0x09e6),
  );
}

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

/** One promise the text appears to make. */
export interface OfferClaim {
  kind: "PCT" | "TAKA" | "FREE";
  /** The figure, or null for a FREE claim, which has no number. */
  value: number | null;
  /** The matched fragment, for the refusal message. Never a whole message. */
  text: string;
}

/**
 * A percentage: `20%`, `২০%`, `20 শতাংশ`, `20 percent`.
 *
 * Bounded to 1-3 digits so a phone number or a date cannot become a discount.
 */
const PCT_PATTERNS = [
  /(\d{1,3})\s*%/g,
  /(\d{1,3})\s*(?:শতাংশ|পার্সেন্ট|percent)/gi,
];

/**
 * A taka figure: `৳300`, `300 টাকা`, `300 tk`, `BDT 300`.
 *
 * Deliberately includes plain prices, not only the word "discount". A message
 * saying "our facial is ৳৮০০" is a business claim, and a wrong one damages the
 * shop whether or not the sentence contains the word ছাড়.
 */
const TAKA_PATTERNS = [
  /৳\s*(\d{1,7})/g,
  /(?:tk|bdt)\.?\s*(\d{1,7})/gi,
  /(\d{1,7})\s*(?:টাকা|taka|tk|bdt)/gi,
];

/**
 * A free-of-charge promise. No number, so the only verification available is
 * "does this shop actually have a free-service reward configured".
 */
const FREE_PATTERN = /(ফ্রি|বিনামূল্যে|একদম\s*ফ্রি|free of charge|\bfree\b|উপহার)/gi;

/**
 * Every offer-shaped claim in a piece of text.
 *
 * Deduplicated by kind+value, because "২০% ছাড় — হ্যাঁ, ২০%!" is one promise
 * made twice and refusing it twice would just be noise in the message.
 */
export function offerClaimsIn(text: string): OfferClaim[] {
  const normalised = toWesternDigits(text ?? "");
  const found = new Map<string, OfferClaim>();

  const add = (claim: OfferClaim) => {
    const key = `${claim.kind}:${claim.value ?? ""}`;
    if (!found.has(key)) found.set(key, claim);
  };

  for (const pattern of PCT_PATTERNS) {
    for (const match of normalised.matchAll(pattern)) {
      const value = Number(match[1]);
      // 0% is not a promise, and anything over 100 is not a percentage — both
      // are far likelier to be a stray number than an offer.
      if (Number.isFinite(value) && value > 0 && value <= 100) {
        add({ kind: "PCT", value, text: match[0].trim() });
      }
    }
  }

  for (const pattern of TAKA_PATTERNS) {
    for (const match of normalised.matchAll(pattern)) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0) {
        add({ kind: "TAKA", value, text: match[0].trim() });
      }
    }
  }

  const free = normalised.match(FREE_PATTERN);
  if (free) add({ kind: "FREE", value: null, text: free[0].trim() });

  return [...found.values()];
}

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

/**
 * What this shop has actually configured, read from its own rows.
 *
 * Assembled server-side from `offers`, `rewards` and `services` — never from
 * anything the model said. Every list is a set of figures the shop itself
 * entered, so a claim matching one of them is a claim the shop can honour.
 */
export interface ShopOfferFacts {
  /** `offers.discount_pct` (active) and `rewards.value` for DISCOUNT_PCT. */
  discountPcts: readonly number[];
  /** `rewards.value` for DISCOUNT_FLAT. */
  flatDiscounts: readonly number[];
  /** `services.rate` (active). A real price is a verified fact. */
  servicePrices: readonly number[];
  /** Whether any active reward is a FREE_SERVICE. */
  hasFreeServiceReward: boolean;
}

/** An empty fact set — a shop with nothing configured verifies nothing. */
export const NO_OFFER_FACTS: ShopOfferFacts = {
  discountPcts: [],
  flatDiscounts: [],
  servicePrices: [],
  hasFreeServiceReward: false,
};

/**
 * Which of these claims the shop cannot back up.
 *
 * A taka figure matches either a configured flat discount or a real service
 * price: both are things the shop wrote down, and a message quoting either is
 * quoting the shop rather than inventing.
 */
export function unverifiedClaims(
  claims: readonly OfferClaim[],
  facts: ShopOfferFacts,
): OfferClaim[] {
  return claims.filter((claim) => {
    if (claim.kind === "FREE") return !facts.hasFreeServiceReward;
    if (claim.value === null) return true;
    if (claim.kind === "PCT") return !facts.discountPcts.includes(claim.value);
    return (
      !facts.flatDiscounts.includes(claim.value) &&
      !facts.servicePrices.includes(claim.value)
    );
  });
}

// ---------------------------------------------------------------------------
// The whole check
// ---------------------------------------------------------------------------

/** Why campaign text was refused. A closed set, like every other refusal. */
export type CampaignContentProblem =
  | "TITLE_EMPTY"
  | "TITLE_TOO_LONG"
  | "BODY_EMPTY"
  | "BODY_TOO_LONG"
  | "INVENTED_OFFER";

export interface CampaignContentVerdict {
  ok: boolean;
  problem?: CampaignContentProblem;
  /** For INVENTED_OFFER: the fragments that matched nothing. */
  unverified?: OfferClaim[];
}

/**
 * Shape and length only. What the owner's own edit is held to.
 *
 * Trimmed lengths, because a title of eighty spaces is an empty title, and the
 * database stores the trimmed form (`ai_action_apply_campaign_edit` applies
 * `btrim`), so checking the untrimmed length here would refuse text the
 * database would have accepted.
 */
export function campaignShapeProblem(
  title: string,
  body: string,
): CampaignContentProblem | null {
  const t = (title ?? "").trim();
  const b = (body ?? "").trim();
  if (t.length === 0) return "TITLE_EMPTY";
  if (t.length > CAMPAIGN_TITLE_MAX) return "TITLE_TOO_LONG";
  if (b.length === 0) return "BODY_EMPTY";
  if (b.length > CAMPAIGN_BODY_MAX) return "BODY_TOO_LONG";
  return null;
}

/**
 * Shape, length AND the offer guard. What MODEL-drafted text is held to.
 *
 * The order matters a little: shape first, so an empty message is reported as
 * empty rather than as offerless.
 */
export function checkDraftedCampaign(input: {
  title: string;
  body: string;
  facts: ShopOfferFacts;
}): CampaignContentVerdict {
  const shape = campaignShapeProblem(input.title, input.body);
  if (shape) return { ok: false, problem: shape };

  const claims = offerClaimsIn(`${input.title}\n${input.body}`);
  const unverified = unverifiedClaims(claims, input.facts);
  if (unverified.length > 0) {
    return { ok: false, problem: "INVENTED_OFFER", unverified };
  }

  return { ok: true };
}
