/**
 * The six customer segments, and the numbers that define them.
 *
 * ---------------------------------------------------------------------------
 * What this file is, and what it deliberately is not
 * ---------------------------------------------------------------------------
 * It is the VOCABULARY: which segments exist, what rule each one is, which
 * window it reads, how it should be described to an owner, and the bounds
 * around all of it. It is pure — no client, no database, no `server-only` —
 * which is what lets the AI layer, the provider UI and the tests all share one
 * answer to "what is a regular customer".
 *
 * It is NOT where membership is decided. Not one customer is selected here.
 * `shop_segment_rows()` in 20261002 does that, in SQL, behind
 * `is_shop_owner()`, and the brief is explicit about why: "DO NOT let the LLM
 * decide raw membership of a segment. The database/application logic must
 * determine the segment." Computing it here would also mean pulling a shop's
 * entire visit history into JavaScript to group it, which is the wrong place
 * for a shop with four hundred customers.
 *
 * ---------------------------------------------------------------------------
 * How `computeRegulars` is reused, honestly
 * ---------------------------------------------------------------------------
 * The brief asks that REGULARS "reuse existing computeRegulars if applicable".
 * What is genuinely reusable is its RULE — two completed visits — not its code:
 * that function is a pure grouping over rows a screen already fetched, and the
 * segment layer works over rows it must not fetch.
 *
 * So the THRESHOLD moved here and `compute-regulars.ts` now imports it. There
 * is one number, in one place, and three things read it: the provider's
 * Regulars screen, the SQL segment rule, and the existing
 * `broadcast_shop_notification('regulars')`, whose `having count(*) >= 2`
 * already agreed with it by coincidence and now agrees by construction. A test
 * asserts the SQL still matches.
 *
 * ---------------------------------------------------------------------------
 * The window is a DATE, and that is load-bearing
 * ---------------------------------------------------------------------------
 * `sinceDate()` returns a calendar day in Asia/Dhaka, not an instant. A cutoff
 * of "now minus sixty days" moves continuously, so a customer whose last visit
 * was sixty days and five minutes ago would slide into LAPSED while the owner
 * read the draft — and the send would then refuse with SEGMENT_CHANGED for a
 * reason nobody could explain. A date computed once, stored on the proposal and
 * passed back at send time means the only thing that can move the set is real
 * customer activity, which is exactly what SEGMENT_CHANGED should mean.
 */

// ---------------------------------------------------------------------------
// The vocabulary
// ---------------------------------------------------------------------------

/**
 * Six, and the absences are considered.
 *
 * Mirrors `ai_actions_campaign_segment_known` in 20261002, which pins the same
 * six in the table — so a seventh cannot be stored until somebody adds it in
 * both places, which is the review moment that constraint exists to force.
 *
 * Referral-engaged was considered and deferred rather than padded in. It is
 * calculable (`referrals.referrer_id` where the status is CONVERTED) and it is
 * in the brief's list of possibilities, but a campaign to people who have
 * referred somebody needs a referral offer to talk about, and whether a shop
 * has one is per-shop and optional. Without that, the message the assistant
 * could honestly write is "thank you", and an owner does not need an AI to
 * decide to say thank you. It is in the sprint's backlog with that reasoning.
 */
export const SEGMENT_KEYS = [
  "REGULARS",
  "HIGH_FREQUENCY",
  "RECENT",
  "LAPSED",
  "MEMBERS",
  "LOYALTY_ENGAGED",
] as const;

export type SegmentKey = (typeof SEGMENT_KEYS)[number];

/**
 * Is this one of the six?
 *
 * The gate the AI layer puts in front of anything the model named. A segment
 * key is a string the model chose, so it is checked against this list before
 * it reaches a query — and the SQL refuses an unknown key by returning nothing
 * rather than everything, which is the second layer.
 */
export function isSegmentKey(value: unknown): value is SegmentKey {
  return typeof value === "string" && (SEGMENT_KEYS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// The numbers
// ---------------------------------------------------------------------------

/**
 * Two completed visits makes somebody a regular.
 *
 * Not a new opinion: this was `REGULAR_VISIT_THRESHOLD` inside
 * `compute-regulars.ts`, which has defined the provider's Regulars screen since
 * Sprint 32, and `broadcast_shop_notification('regulars')` has used the same 2
 * since 20260729. Promoted here so all three read one constant.
 */
export const REGULAR_VISIT_THRESHOLD = 2;

/**
 * Five makes them a frequent one.
 *
 * A stricter cut of the same rule rather than a different rule, and it is a
 * judgement — recorded as one. For a salon where a haircut is monthly, five
 * visits inside a two-month window means somebody who comes for more than
 * haircuts. There is no data-derived "correct" value here and this file does
 * not pretend otherwise.
 */
export const HIGH_FREQUENCY_VISIT_THRESHOLD = 5;

/** The default window: two months of "recently". */
export const DEFAULT_LOOKBACK_DAYS = 60;
/**
 * A week is the shortest window worth asking about. Below that, "has not been
 * in recently" describes almost every customer of almost every shop.
 */
export const MIN_LOOKBACK_DAYS = 7;
/**
 * And a year is the longest. Past that, "no visit in the window" and "not a
 * customer of this shop" stop being different statements.
 */
export const MAX_LOOKBACK_DAYS = 365;

/**
 * Below this many completed visits, a shop has no segments worth naming.
 *
 * §24's minimum-data guard. A shop with four completed jobs technically has
 * regulars — whoever came twice — but calling that a segment, and drawing a
 * retention conclusion from it, is manufacturing an insight from a sample.
 * The tools report the thin-data note instead, which is the analytics
 * convention the rest of this product already follows.
 */
export const MIN_SHOP_VISITS_FOR_SEGMENTS = 10;

/**
 * The smallest audience a campaign may have.
 *
 * A judgement, and worth stating as one: a broadcast is written for a group.
 * With one or two people the owner should message them directly — the app has
 * that — rather than send a promotional blast addressed to nobody in
 * particular. Enforced again by `ai_action_propose` and again by
 * `ai_actions_campaign_bounds`.
 */
export const MIN_CAMPAIGN_RECIPIENTS = 3;

/**
 * And the largest. §25's abuse ceiling, matching the table's own CHECK.
 *
 * Not a performance limit — five hundred notification rows is nothing. It is
 * the blast radius of one mistake, and of one compromised session.
 */
export const MAX_CAMPAIGN_RECIPIENTS = 500;

// ---------------------------------------------------------------------------
// What each segment is
// ---------------------------------------------------------------------------

export interface SegmentDefinition {
  key: SegmentKey;
  /**
   * The rule, in English, for the model's context. Written as a statement of
   * what the database did, so the model can repeat it to the owner without
   * embellishing: every one of these is a `WHERE` clause, and the description
   * says so.
   */
  rule: string;
  /** What the owner's card calls it. */
  labelBn: string;
  /**
   * Why these customers, in Bangla, for the card's "why" line. Takes the
   * window so the sentence names the actual cutoff rather than "recently".
   *
   * The LAPSED wording is the careful one. "গত ৬০ দিনে একবারও আসেনি" is a
   * fact about the records. "চলে যাবে" would be a prediction, and §23 forbids
   * it — there is no churn probability in this product and this is where that
   * starts.
   */
  reasonBn: (lookbackDays: number) => string;
  /** Does `lookbackDays` change who is in it? */
  usesWindow: boolean;
  /**
   * How the membership moves on its own.
   *
   *   "visit-history"  changes only when somebody completes a visit
   *   "point-in-time"  changes when a membership lapses or a balance moves
   *
   * This matters because the send refuses on SEGMENT_CHANGED, so a
   * point-in-time segment is likelier to need re-asking. Recorded here rather
   * than discovered by an owner wondering why their campaign keeps expiring.
   */
  volatility: "visit-history" | "point-in-time";
  /** Does this segment need the shop to have visit history at all? */
  needsVisitHistory: boolean;
}

export const SEGMENTS: Record<SegmentKey, SegmentDefinition> = {
  REGULARS: {
    key: "REGULARS",
    rule: `Customers with at least ${REGULAR_VISIT_THRESHOLD} completed visits inside the window. A completed visit is a finished job — a DONE serial or a DONE appointment — never a booking that was cancelled or missed.`,
    labelBn: "নিয়মিত কাস্টমার",
    reasonBn: (days) =>
      `গত ${days} দিনে অন্তত ${REGULAR_VISIT_THRESHOLD} বার সার্ভিস নিয়েছেন।`,
    usesWindow: true,
    volatility: "visit-history",
    needsVisitHistory: true,
  },
  HIGH_FREQUENCY: {
    key: "HIGH_FREQUENCY",
    rule: `Customers with at least ${HIGH_FREQUENCY_VISIT_THRESHOLD} completed visits inside the window. A stricter cut of REGULARS, not a separate rule.`,
    labelBn: "সবচেয়ে বেশি আসেন যাঁরা",
    reasonBn: (days) =>
      `গত ${days} দিনে অন্তত ${HIGH_FREQUENCY_VISIT_THRESHOLD} বার সার্ভিস নিয়েছেন।`,
    usesWindow: true,
    volatility: "visit-history",
    needsVisitHistory: true,
  },
  RECENT: {
    key: "RECENT",
    rule: "Customers with at least one completed visit inside the window.",
    labelBn: "সম্প্রতি এসেছেন যাঁরা",
    reasonBn: (days) => `গত ${days} দিনে অন্তত একবার সার্ভিস নিয়েছেন।`,
    usesWindow: true,
    volatility: "visit-history",
    needsVisitHistory: true,
  },
  LAPSED: {
    key: "LAPSED",
    rule: "Customers who have completed at least one visit at this shop EVER, and none inside the window. This describes the records and nothing else: it is not a prediction, not a churn score, and not a probability. Somebody who has never visited is not lapsed — they are not a customer.",
    labelBn: "অনেকদিন আসেননি যাঁরা",
    reasonBn: (days) =>
      `আগে এসেছেন, কিন্তু গত ${days} দিনে একবারও সার্ভিস নেননি।`,
    usesWindow: true,
    volatility: "visit-history",
    needsVisitHistory: true,
  },
  MEMBERS: {
    key: "MEMBERS",
    rule: "Customers holding an active membership at this shop right now, decided by the existing membership_is_active() check. The window does not affect who is in this segment. Some of them may never have completed a visit, and the insights say how many.",
    labelBn: "মেম্বারশিপ আছে যাঁদের",
    reasonBn: () => "এই দোকানে এখন সক্রিয় মেম্বারশিপ আছে।",
    usesWindow: false,
    volatility: "point-in-time",
    needsVisitHistory: false,
  },
  LOYALTY_ENGAGED: {
    key: "LOYALTY_ENGAGED",
    rule: "Customers holding a loyalty points balance above zero AT THIS SHOP. Points are per business, so this is never a balance from anywhere else. The window does not affect who is in this segment.",
    labelBn: "পয়েন্ট জমেছে যাঁদের",
    reasonBn: () => "এই দোকানে খরচ করার মতো পয়েন্ট জমে আছে।",
    usesWindow: false,
    volatility: "point-in-time",
    needsVisitHistory: false,
  },
};

/** Every definition, in the declared order. For prompts and for listings. */
export const SEGMENT_LIST: readonly SegmentDefinition[] = SEGMENT_KEYS.map(
  (key) => SEGMENTS[key],
);

// ---------------------------------------------------------------------------
// The window
// ---------------------------------------------------------------------------

/** Why a lookback was refused, or null. */
export type LookbackProblem = "TOO_SHORT" | "TOO_LONG" | "MALFORMED";

export function lookbackProblem(days: unknown): LookbackProblem | null {
  if (typeof days !== "number" || !Number.isInteger(days)) return "MALFORMED";
  if (days < MIN_LOOKBACK_DAYS) return "TOO_SHORT";
  if (days > MAX_LOOKBACK_DAYS) return "TOO_LONG";
  return null;
}

/**
 * The window's start, as a calendar day in Asia/Dhaka.
 *
 * `YYYY-MM-DD`, computed by shifting into Dhaka and reading the UTC-based
 * getters — the same two lines `dhakaToday()` and `gatherShopBrief()` already
 * use, and NOT `ymd()`, whose getters are local and would apply the offset
 * twice on a contributor's machine in another zone.
 *
 * The +6 is this project's existing fixed convention: Bangladesh has observed
 * no DST since 2010, so a fixed offset is the whole truth here.
 */
export function sinceDate(now: Date, lookbackDays: number): string {
  const dhaka = now.getTime() + 6 * 60 * 60 * 1000;
  const shifted = dhaka - lookbackDays * 24 * 60 * 60 * 1000;
  return new Date(shifted).toISOString().slice(0, 10);
}

/**
 * How many recipients is too few or too many, or null.
 *
 * Returned as a reason rather than a boolean so the owner is told which — "that
 * group is too small to send a broadcast to" and "that is more people than one
 * campaign may reach" want different next steps.
 */
export type AudienceProblem = "TOO_SMALL" | "TOO_LARGE";

export function audienceProblem(count: number): AudienceProblem | null {
  if (count < MIN_CAMPAIGN_RECIPIENTS) return "TOO_SMALL";
  if (count > MAX_CAMPAIGN_RECIPIENTS) return "TOO_LARGE";
  return null;
}

/**
 * Are two recipient snapshots the same set of people?
 *
 * Order-insensitive, because "the same people in a different order" is the same
 * audience and refusing it would be a bug that looks like caution.
 * `shop_campaign_recipients()` sorts its output, so in practice the arrays
 * arrive in the same order anyway — this does not rely on that.
 *
 * Used at send time for the SEGMENT_CHANGED check. Strict equality, not a
 * tolerance: the owner approved a specific group, and the concrete harm is not
 * abstract — a customer who visited yesterday receiving "we have not seen you
 * in a while" is the embarrassment this guard exists to prevent, and a
 * tolerance would let exactly that through.
 */
export function sameAudience(
  a: readonly string[] | null | undefined,
  b: readonly string[] | null | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const left = new Set(a);
  if (left.size !== a.length) return false; // a duplicate is not a valid snapshot
  return b.every((id) => left.has(id));
}
