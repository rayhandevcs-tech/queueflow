import { IdWhitelist } from "./security";

/**
 * Proposals: what the assistant may ASK for, and how that ask is kept honest.
 *
 * ---------------------------------------------------------------------------
 * The shape of the sprint, in one paragraph
 * ---------------------------------------------------------------------------
 * The model is allowed to describe an action. It is not allowed to perform one,
 * and it is not allowed to be believed about the identifiers involved. So:
 *
 *   discovery tools return rows  →  every id they returned is recorded here
 *   the model asks to prepare    →  its ids are checked against that record
 *   a draft is assembled         →  from the DATABASE's figures, not the model's
 *   the route persists it        →  as a PROPOSED row, outside the model's reach
 *   the customer confirms        →  a separate request, a separate endpoint
 *   the endpoint revalidates     →  and calls the app's OWN business function
 *
 * Nothing in this file writes anything. It is pure: types, a ledger, and the
 * vocabulary of refusals. That is deliberate — it means the rules can be tested
 * directly, with no client, no key and no database, and it keeps the interesting
 * logic out of the route where it would be reachable only through HTTP.
 *
 * ---------------------------------------------------------------------------
 * Three actions now, and one shape for all of them
 * ---------------------------------------------------------------------------
 * Sprint 3 added JOIN_QUEUE. Sprint 4 adds BOOK_APPOINTMENT and REDEEM_REWARD,
 * and the interesting thing is how little had to change: the drafts became a
 * discriminated union, the ledger learned two more kinds of id, and the refusal
 * vocabulary grew. The lifecycle, the nonce, the expiry and the confirmation
 * boundary are the Sprint 3 ones, untouched.
 *
 * A discriminated union rather than one object with everything optional. With
 * optional fields, "an appointment with no time" and "a redemption with a
 * staff member" are both representable, and every reader has to re-derive which
 * combinations are real. With `action` as the discriminant the compiler does
 * that, and `ai_actions_params_match_type` in 20261001 does it again in the
 * database — so a nonsense row cannot be stored even if this file were wrong.
 *
 * ---------------------------------------------------------------------------
 * Why `readOnly: true` on a tool called `prepare_book_appointment` is honest
 * ---------------------------------------------------------------------------
 * Because it writes nothing. Each prepare tool validates ids, reads the shop,
 * the services, the slot or the reward, and hands back a description. The
 * PROPOSED row is written by the route after the loop has finished, from the
 * draft the tool left in the ledger — so the persistence happens in code the
 * model cannot call, cannot influence the arguments of, and never sees the
 * result of.
 *
 * This matters because the brief's line "the generic agent loop is read-only …
 * keep that security boundary" is not a naming preference. The loop refuses
 * non-read-only tools, and that refusal is load-bearing (see
 * `agent-readonly.test.ts`). Weakening it to make either new action work would
 * have removed the guarantee Sprints 1 and 2 rest on. So the guard stays
 * exactly as it was, every tool in the registry is still read-only, and all
 * three mutations live outside the loop entirely.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** Join a salon queue. AI Sprint 3. */
export const AI_ACTION_JOIN_QUEUE = "JOIN_QUEUE" as const;
/** Book a parlour appointment. AI Sprint 4. */
export const AI_ACTION_BOOK_APPOINTMENT = "BOOK_APPOINTMENT" as const;
/** Spend loyalty points on a coupon. AI Sprint 4. */
export const AI_ACTION_REDEEM_REWARD = "REDEEM_REWARD" as const;
/**
 * Send an owner-approved retention campaign. AI Sprint 5.
 *
 * The only action in this union that belongs to an OWNER rather than a
 * customer, and the only one whose effect lands on other people. Both facts
 * are why it has the longest confirmation path: the segment is computed in SQL,
 * the audience is frozen at propose time, the owner may rewrite the message,
 * and the send refuses unless the recomputed audience is still the same people.
 */
export const AI_ACTION_SEND_CAMPAIGN = "SEND_CAMPAIGN" as const;

export type AiActionType =
  | typeof AI_ACTION_JOIN_QUEUE
  | typeof AI_ACTION_BOOK_APPOINTMENT
  | typeof AI_ACTION_REDEEM_REWARD
  | typeof AI_ACTION_SEND_CAMPAIGN;

/**
 * The complete list, mirroring `public.ai_action_type`.
 *
 * Four, and the absences are the point: there is no CANCEL_APPOINTMENT,
 * RESCHEDULE_APPOINTMENT, AUTO_SEND, SCHEDULE_CAMPAIGN or BULK_MESSAGE here and
 * none in the enum either, so the confirm endpoint refusing an unknown type is
 * a guarantee rather than a hope — an unknown type cannot be stored in the
 * first place.
 */
export const AI_ACTION_TYPES: readonly AiActionType[] = [
  AI_ACTION_JOIN_QUEUE,
  AI_ACTION_BOOK_APPOINTMENT,
  AI_ACTION_REDEEM_REWARD,
  AI_ACTION_SEND_CAMPAIGN,
];

/** The lifecycle, mirroring `public.ai_action_status`. */
export type AiActionStatus =
  | "PROPOSED"
  | "CONFIRMED"
  | "EXECUTED"
  | "CANCELLED"
  | "EXPIRED"
  | "FAILED";

/**
 * How long a proposal stays confirmable.
 *
 * Five minutes for a queue join, and the number is a judgement about what the
 * card SAYS rather than about security. The wait estimate on it came from a
 * live queue; after a few minutes it is describing a shop that has moved on,
 * and asking somebody to agree to a stale number is the thing expiry exists to
 * prevent.
 *
 * The database decides, not these constants: `ai_action_propose()` takes the
 * TTL as a bounded argument (30s–30min) and computes `expires_at` with `now()`
 * on the server, so a wrong clock or a tampered client cannot extend it.
 */
export const AI_PROPOSAL_TTL_SECONDS = 300;

/**
 * Three minutes for an appointment, and shorter for a real reason rather than
 * for the appearance of caution: a slot is *contended*. While the card sits
 * there another customer can take that exact time, and every second of TTL is a
 * second in which the confirmation will fail on `appointments_no_overlap`
 * instead of succeeding. A short window means the customer meets a live card or
 * an expired one, rather than a card that looks live and cannot be used.
 */
export const AI_APPOINTMENT_TTL_SECONDS = 180;

/**
 * Three minutes for a redemption, because both halves of what the card says can
 * move underneath it: the points balance (a visit completing adds points, and
 * another redemption spends them) and the reward itself (the shop can switch it
 * off, change its cost or run out of stock).
 */
export const AI_REWARD_TTL_SECONDS = 180;

/**
 * Ten minutes for a campaign, and longer than the others for a reason that
 * runs the opposite way.
 *
 * The other three are short because what they describe is contended or moving,
 * and a stale card is a card that cannot be used. A campaign is not contended:
 * nobody else is competing for these forty-three customers. What the window
 * has to accommodate instead is a person READING a message and deciding whether
 * to put their shop's name to it — and possibly rewriting it first. Three
 * minutes for that would mean an owner who stopped to think lost their draft.
 *
 * Ten minutes is still an expiry rather than none, because the audience is
 * recomputed at send time and refused if it moved: a very old proposal is one
 * whose SEGMENT_CHANGED refusal is nearly certain, so letting it sit for an
 * hour would only produce a slower failure.
 */
export const AI_CAMPAIGN_TTL_SECONDS = 600;

/** The TTL for one action type. One place, so the card and the row agree. */
export function ttlForAction(action: AiActionType): number {
  switch (action) {
    case AI_ACTION_BOOK_APPOINTMENT:
      return AI_APPOINTMENT_TTL_SECONDS;
    case AI_ACTION_REDEEM_REWARD:
      return AI_REWARD_TTL_SECONDS;
    case AI_ACTION_SEND_CAMPAIGN:
      return AI_CAMPAIGN_TTL_SECONDS;
    default:
      return AI_PROPOSAL_TTL_SECONDS;
  }
}

/** Bytes of randomness in a proposal nonce. */
const NONCE_BYTES = 24;

/**
 * Why a proposal or a confirmation was refused.
 *
 * A closed set, because these become an audit `failure_code` and a Bangla
 * sentence, and both want a fixed vocabulary. Notably absent: anything derived
 * from a Postgres message. `translateDbError()` already maps constraint names
 * to sentences for the rest of the app; what the audit stores is which of these
 * codes was chosen, never the database's own words.
 *
 * The distinctions are kept even where two codes would produce a similar
 * sentence, because the audit is where somebody later asks "why did this fail"
 * — and "the slot had gone" and "the service was switched off" are different
 * answers with different fixes.
 */
export type ProposalRefusal =
  // --- shared ---------------------------------------------------------------
  /** The model named a shop no discovery tool in this request returned. */
  | "SHOP_NOT_OFFERED"
  /** The model named a service no discovery tool in this request returned. */
  | "SERVICE_NOT_OFFERED"
  /** The shop is gone, or RLS will not show it. */
  | "SHOP_NOT_FOUND"
  /** A service id that does not exist or is not visible. */
  | "SERVICE_NOT_FOUND"
  /** The service belongs to a different shop than the one proposed. */
  | "SERVICE_WRONG_SHOP"
  /** Switched off by the shop. */
  | "SERVICE_INACTIVE"
  /** The proposal lapsed before it was confirmed. */
  | "EXPIRED"
  /** Confirmed once already. */
  | "ALREADY_EXECUTED"
  /** The customer said no. */
  | "CANCELLED"
  /** Not this customer's proposal, or no such proposal. */
  | "NOT_FOUND"
  /** The nonce did not match the stored one. */
  | "BAD_NONCE"
  /** Anything unforeseen. Never a raw message. */
  | "UNAVAILABLE"

  // --- JOIN_QUEUE -----------------------------------------------------------
  /** A parlour. It takes appointments; there is no queue to join. */
  | "NOT_A_QUEUE_SHOP"
  /** Closed or not taking new serials. */
  | "SHOP_NOT_ACCEPTING"
  /** They already have a serial running — the queue permits one. */
  | "ALREADY_IN_QUEUE"
  /** The queue itself refused the insert. The audit keeps the reason. */
  | "QUEUE_REFUSED"

  // --- BOOK_APPOINTMENT -----------------------------------------------------
  /** A salon or unisex shop. It runs a queue; there is nothing to book. */
  | "NOT_AN_APPOINTMENT_SHOP"
  /** The shop is not ACTIVE, so `appointment_before_insert` would refuse it. */
  | "SHOP_NOT_ACTIVE"
  /** The model named a time `get_available_slots` did not return this turn. */
  | "SLOT_NOT_OFFERED"
  /** The slot was free when it was offered and is not free now. */
  | "SLOT_UNAVAILABLE"
  /** The time has passed. */
  | "SLOT_IN_PAST"
  /** No such staff member, or RLS will not show them. */
  | "STAFF_NOT_FOUND"
  /** The staff member belongs to another shop. */
  | "STAFF_WRONG_SHOP"
  /** Switched off by the shop. */
  | "STAFF_INACTIVE"
  /** `chair_service_stats` says they do not do one of these services. */
  | "STAFF_CANNOT_PERFORM"
  /** A service has no `default_duration_min`, so the slot length is unknown. */
  | "DURATION_UNAVAILABLE"
  /**
   * The price moved between the proposal and the confirmation.
   *
   * A refusal rather than a silent re-price: the customer agreed to a figure,
   * and charging a different one because it happens to be current is the thing
   * §11 of the brief forbids. They are asked again with the new number.
   */
  | "PRICE_CHANGED"
  /** They already hold an appointment overlapping this time. */
  | "ALREADY_BOOKED"
  /** `book_appointment` refused it. The audit keeps the reason. */
  | "APPOINTMENT_REFUSED"

  // --- REDEEM_REWARD --------------------------------------------------------
  /** The model named a reward no discovery tool in this request returned. */
  | "REWARD_NOT_OFFERED"
  /** No such reward, or RLS will not show it (which includes switched off). */
  | "REWARD_NOT_FOUND"
  /**
   * The reward belongs to another shop.
   *
   * This is the business-scoped-loyalty refusal, and it is the reason the code
   * exists separately from REWARD_NOT_FOUND: points earned at one shop buy
   * nothing at another, and the customer deserves to be told which it is.
   */
  | "REWARD_WRONG_SHOP"
  /** Switched off by the shop. */
  | "REWARD_INACTIVE"
  /** Past its `valid_until`. */
  | "REWARD_EXPIRED"
  /** `rewards.stock` is exhausted — this product's redemption limit. */
  | "REWARD_OUT_OF_STOCK"
  /** Not enough points AT THIS SHOP. Never a total across shops. */
  | "INSUFFICIENT_POINTS"
  /** No points card at this shop at all, so nothing to spend. */
  | "NO_LOYALTY_ACCOUNT"
  /** `redeem_reward` refused it. The audit keeps the reason. */
  | "REDEMPTION_REFUSED"

  // --- SEND_CAMPAIGN (owner) ------------------------------------------------
  /** The caller has no shop, or does not own the one named. */
  | "NOT_SHOP_OWNER"
  /** The model named a segment no segment tool returned this request. */
  | "SEGMENT_NOT_OFFERED"
  /** Not one of the six. The model invented a segment name. */
  | "SEGMENT_UNKNOWN"
  /** The shop has too little completed-visit history to segment honestly. */
  | "NOT_ENOUGH_HISTORY"
  /** Nobody is in it, so there is nothing to send. */
  | "SEGMENT_EMPTY"
  /** Fewer than three reachable people — see MIN_CAMPAIGN_RECIPIENTS. */
  | "SEGMENT_TOO_SMALL"
  /** More than one campaign may reach at once. */
  | "SEGMENT_TOO_LARGE"
  /** The lookback window is outside the range the segments cover. */
  | "WINDOW_INVALID"
  /**
   * The audience moved between the proposal and the approval.
   *
   * The refusal §15 asks for by name. The owner approved a specific group of
   * people; if somebody has since completed a visit and left LAPSED, sending to
   * the old list would mean telling a customer who came in yesterday that they
   * have not been seen in a while. Refusing and re-asking costs one question.
   */
  | "SEGMENT_CHANGED"
  /** The title or body is empty, or past its length bound. */
  | "CAMPAIGN_CONTENT_INVALID"
  /**
   * The drafted text promises something the shop has not configured.
   *
   * §9's rule. Applies to text the MODEL wrote; an owner's own edit is not held
   * to it, because the owner is the business and may promise what they like.
   */
  | "CAMPAIGN_INVENTS_OFFER"
  /** The shop's one promotional broadcast for today has already gone out. */
  | "BROADCAST_LIMIT_REACHED"
  /** A recipient in the snapshot is not this shop's customer. */
  | "RECIPIENT_NOT_A_CUSTOMER"
  /** `broadcast_campaign` refused it. The audit keeps the reason. */
  | "CAMPAIGN_REFUSED";

/**
 * Thrown by the prepare tools and the confirm path.
 *
 * `message` is the code and nothing else, which matters because `agent-loop.ts`
 * passes a ProposalError's message straight to the model — that is how
 * "NOT_A_QUEUE_SHOP" reaches it and lets it redirect the customer to
 * appointments rather than apologising.
 *
 * `detail` is the separate, optional, ALREADY-SCRUBBED sentence for the person:
 * `translateDbError()`'s Bangla for a refusal the database produced, so a slot
 * somebody else took reads the same however the customer arrived at it. It is
 * deliberately not part of `message` and is never shown to the model — one is
 * a code for a machine, the other is a sentence for a human, and merging them
 * would put database text into the model's context.
 */
export class ProposalError extends Error {
  readonly code: ProposalRefusal;
  readonly detail?: string;
  constructor(code: ProposalRefusal, detail?: string) {
    super(code);
    this.name = "ProposalError";
    this.code = code;
    this.detail = detail;
  }
}

// ---------------------------------------------------------------------------
// The drafts
// ---------------------------------------------------------------------------

/** One service on the card, priced from the shop's own record. */
export interface ProposalService {
  serviceId: string;
  name: string;
  /**
   * `services.rate`, or null when the shop has not set one. Never estimated —
   * the confirmation card says "price not listed" rather than inventing a
   * figure, and the amount actually recorded is computed by the insert trigger
   * regardless of what is shown here.
   */
  priceTaka: number | null;
  /**
   * `services.default_duration_min` — the canonical field, and the ONLY source
   * of appointment length. Never a rolling queue average, never
   * `chair_service_stats.rolling_avg_duration_min`, never a historical mean:
   * those describe how long a job took in a queue, and using them to size an
   * appointment slot would make the assistant disagree with the availability
   * engine, which reads this column.
   */
  durationMin: number | null;
}

/**
 * What the customer is about to be asked, assembled from verified reads.
 *
 * Every field in all three drafts came from the database in the same request.
 * The model chose WHICH shop, WHICH services, WHICH slot and WHICH reward from
 * what it had been offered; it supplied none of the names, none of the prices,
 * none of the durations, none of the point costs and none of the balances.
 */
export interface JoinQueueDraft {
  action: typeof AI_ACTION_JOIN_QUEUE;
  shopId: string;
  shopName: string;
  businessType: string;
  services: ProposalService[];
  /**
   * Sum of the real rates, or null if ANY service is missing a price — a
   * partial total is worse than no total, because it reads as complete. The
   * card shows "unavailable" in that case.
   */
  totalTaka: number | null;
  /**
   * Minutes, from `chairFreeAtMs`/`minutesUntil` — the same arithmetic the
   * explore card uses. null means "there are people waiting but no estimate
   * yet", which is a different statement from 0.
   */
  estimatedWaitMin: number | null;
  waitingCount: number;
}

/** A parlour appointment, at one verified slot. */
export interface AppointmentDraft {
  action: typeof AI_ACTION_BOOK_APPOINTMENT;
  shopId: string;
  shopName: string;
  businessType: string;
  services: ProposalService[];
  totalTaka: number | null;
  /**
   * Sum of `services.default_duration_min`. Not nullable: a service without a
   * duration is refused as DURATION_UNAVAILABLE before a draft exists, because
   * an appointment with an unknown length has no end and cannot be checked
   * against anybody's working hours.
   */
  durationMin: number;
  /**
   * The staff member, from the slot. `chairs.id` — the same row that is a seat
   * in a salon and a beautician in a parlour. Never a value the model chose:
   * a slot carries its staff, and choosing the slot is choosing the staff.
   */
  staffId: string;
  staffName: string;
  /** ISO, exactly as `shop_available_slots()` returned it. */
  startsAt: string;
  /**
   * `startsAt + durationMin`, the same arithmetic `appointment_before_insert`
   * uses. Shown so the card can say "5:00–6:00 PM"; the row's real `ends_at` is
   * computed by the trigger, from the trigger's own duration sum.
   */
  endsAt: string;
  /** The deterministic slot identity. See `slotKey`. */
  slotKey: string;
}

/** A points redemption at one shop. */
export interface RewardDraft {
  action: typeof AI_ACTION_REDEEM_REWARD;
  shopId: string;
  shopName: string;
  rewardId: string;
  rewardName: string;
  rewardDescription: string | null;
  /** DISCOUNT_FLAT, DISCOUNT_PCT or FREE_SERVICE — `rewards.kind`. */
  rewardKind: string;
  /** Taka for FLAT, per cent for PCT, null for FREE_SERVICE. `rewards.value`. */
  rewardValue: number | null;
  /** The named service for FREE_SERVICE, so the card is readable. */
  freeServiceName: string | null;
  /** `rewards.points_cost`. The model cannot choose or discount this. */
  pointsCost: number;
  /**
   * The balance AT THIS SHOP, from `loyalty_accounts (shop_id, customer_id)`.
   *
   * Never a sum across shops, and the type deliberately gives no place to put
   * one. QueueFlow points are per business (decision 33): 700 at shop A and 300
   * at shop B is not 1000 anywhere, and a card that said so would be lying
   * about what the customer can spend.
   */
  balance: number;
  /** `balance - pointsCost`, shown so the cost is concrete. */
  balanceAfter: number;
  /** The coupon's own expiry, which is the reward's `valid_until`. */
  validUntil: string | null;
}

/**
 * An owner's retention campaign, against one verified segment.
 *
 * ---------------------------------------------------------------------------
 * What the model contributed, and what it did not
 * ---------------------------------------------------------------------------
 * The model chose the SEGMENT (from the six it was offered), the WINDOW (within
 * bounds) and the WORDS. That is all. Specifically it did not choose:
 *
 *   · the shop — `ctx.shopId`, from the session, re-checked by
 *     `is_shop_owner()` inside `ai_action_propose` and again inside
 *     `broadcast_campaign`;
 *   · who is in the segment — `shop_segment_rows()` decided, in SQL;
 *   · how many people that is — `recipientCount` is the length of the array
 *     the database returned, and the card shows that number;
 *   · whether it may be sent — the owner presses the button.
 *
 * ---------------------------------------------------------------------------
 * The recipient ids are NOT here, on purpose
 * ---------------------------------------------------------------------------
 * This object becomes `ai_actions.display`, which the owner's card reads. The
 * snapshot itself lives in `campaign_recipients`, a column the card does not
 * fetch and the model never sees. The reason is §5: a list of customer uuids
 * is of no use to the model — nothing downstream accepts a customer id from
 * anybody — so putting one in its context would be risk with no benefit.
 *
 * What the model gets instead is a count and a reason, which is what it needs
 * to write a sentence about, and what the owner gets is the same count plus
 * the ability to read the message before anybody receives it.
 */
export interface CampaignDraft {
  action: typeof AI_ACTION_SEND_CAMPAIGN;
  shopId: string;
  shopName: string;
  /** One of the six. Never a name the model made up. */
  segment: string;
  /** What the owner's card calls it, from `SEGMENTS`. */
  segmentLabel: string;
  /** Why these customers, in Bangla. A statement about records, not a forecast. */
  reason: string;
  /** The window, so the card and the audit both name the real cutoff. */
  lookbackDays: number;
  /** `YYYY-MM-DD` in Asia/Dhaka — the cutoff the snapshot was computed from. */
  since: string;
  /**
   * How many people will be messaged: the length of the snapshot, after the
   * promotional opt-out filter. Not a segment size that quietly shrinks at send
   * time, and not a figure the model produced.
   */
  recipientCount: number;
  /** How many are in the segment but have muted promotions. Shown, not hidden. */
  mutedCount: number;
  /** The drafted title and body. Editable by the owner before approval. */
  title: string;
  body: string;
}

/**
 * Any of the four. The `action` field is the discriminant, and it is what the
 * confirm endpoint switches on and what the card renders from.
 */
export type AiProposalDraft =
  | JoinQueueDraft
  | AppointmentDraft
  | RewardDraft
  | CampaignDraft;

/** The persisted proposal, as the card and the confirm path see it. */
export interface StoredProposal {
  id: string;
  status: AiActionStatus;
  actionType: AiActionType;
  shopId: string | null;
  serviceIds: string[];
  nonce: string;
  display: AiProposalDraft | null;
  expiresAt: string;
  createdAt: string;
  /** Appointment parameters, stored server-side. Null for the other types. */
  staffId: string | null;
  startsAt: string | null;
  /** Redemption parameter. Null for the other types. */
  rewardId: string | null;
  /**
   * Campaign parameters. Null for the other three types.
   *
   * `campaignRecipients` is deliberately absent from this interface. The card
   * does not fetch that column and has no use for it: it shows a count, which
   * comes from `display`. Leaving it out means a client that somehow got the
   * array could not display it through the normal path — the snapshot is
   * server-side state, and this type says so by omission.
   */
  campaignSegment: string | null;
  campaignSince: string | null;
  campaignTitle: string | null;
  campaignBody: string | null;
  /** Results — at most one is set, and only on an EXECUTED row. */
  serialId: string | null;
  appointmentId: string | null;
  redemptionId: string | null;
  /** How many notifications an executed campaign actually inserted. */
  campaignSentCount: number | null;
  failureCode: string | null;
}

/**
 * Total the card shows, or null.
 *
 * Separate and exported because it is a rule, not a formatting detail: a total
 * is only shown when every part of it is real. Tested directly.
 */
export function draftTotal(services: readonly ProposalService[]): number | null {
  if (services.length === 0) return null;
  if (services.some((service) => service.priceTaka === null)) return null;
  return services.reduce((sum, service) => sum + (service.priceTaka ?? 0), 0);
}

/**
 * Total duration, or null when any service is missing one.
 *
 * The same rule as `draftTotal` and for the same reason: a slot sized from a
 * partial sum would be shorter than the work, and the appointment would run
 * into the next one. Callers refuse with DURATION_UNAVAILABLE rather than
 * guessing a length.
 */
export function draftDuration(services: readonly ProposalService[]): number | null {
  if (services.length === 0) return null;
  if (services.some((service) => service.durationMin === null)) return null;
  const total = services.reduce((sum, service) => sum + (service.durationMin ?? 0), 0);
  return total > 0 ? total : null;
}

// ---------------------------------------------------------------------------
// The slot's identity
// ---------------------------------------------------------------------------

/**
 * The deterministic identity of one appointment slot.
 *
 * `shop_available_slots()` returns `(staff_id, staff_name, slot_start,
 * slot_end)` and **no slot id** — because a slot is not a row, it is a gap
 * computed on the fly from a 15-minute grid minus what is already booked. So
 * §9's fallback applies: the identity is the tuple, and no fake id is minted.
 *
 * Two details that are the whole value of this function:
 *
 *   · the instant is normalised to epoch milliseconds, not kept as a string.
 *     Postgres, the JS client and the model can all render the same moment as
 *     `2026-09-17T17:00:00+06:00`, `2026-09-17T11:00:00Z` or
 *     `2026-09-17 11:00:00+00`, and a key built from the text would treat three
 *     spellings of one slot as three different slots — which fails open in the
 *     wrong direction: the customer's legitimate confirmation gets refused, and
 *     worse, somebody could later "fix" it by loosening the comparison;
 *
 *   · the shop is part of the key, so a staff id and a time that were offered
 *     for one shop cannot be replayed against another.
 *
 * It throws rather than returning null for an unparseable time, because every
 * caller's correct response is to stop.
 */
export function slotKey(
  shopId: string,
  staffId: string,
  startsAt: string | Date | number,
): string {
  const ms =
    startsAt instanceof Date
      ? startsAt.getTime()
      : typeof startsAt === "number"
        ? startsAt
        : Date.parse(startsAt);
  if (!Number.isFinite(ms)) throw new ProposalError("SLOT_NOT_OFFERED");
  return `${shopId}|${staffId}|${ms}`;
}

// ---------------------------------------------------------------------------
// The ledger
// ---------------------------------------------------------------------------

/**
 * The kinds of thing a discovery tool can offer.
 *
 * "segment" joined in Sprint 5, and it is the one entry that is not a uuid.
 * That is fine — `IdWhitelist` has always keyed by an arbitrary string — and it
 * is the right shape for the same reason the others are: a segment key reaches
 * the campaign path only if `get_customer_segments` returned it in THIS
 * request, so a model that writes `"WILL_CHURN"` or `"HIGH_VALUE"` is refused
 * before any query runs, rather than being handed to SQL that would return an
 * empty set and let the model call that an answer.
 */
export type LedgerKind = "shop" | "service" | "slot" | "reward" | "segment";

/**
 * The refusal for each kind, so the model is told WHICH kind of id it invented.
 *
 * Worth being specific about: "you named a slot I never offered" lets the model
 * call `get_available_slots` and try again, whereas a generic refusal leads it
 * to apologise and stop. Refusing for the right reason is only useful if the
 * reason survives (see the ProposalError note in `agent-loop.ts`).
 */
const REFUSAL_FOR_KIND: Record<LedgerKind, ProposalRefusal> = {
  shop: "SHOP_NOT_OFFERED",
  service: "SERVICE_NOT_OFFERED",
  slot: "SLOT_NOT_OFFERED",
  reward: "REWARD_NOT_OFFERED",
  segment: "SEGMENT_NOT_OFFERED",
};

/**
 * What this request's tools actually returned, and the draft they produced.
 *
 * One of these is created per agent request and put on the `ToolContext`. The
 * discovery tools call `offer()` as they return rows; every `prepare_*` tool
 * calls `requireOffered()` before it will look anything up.
 *
 * The scope is deliberately ONE REQUEST. A proposal cannot be built from ids a
 * previous request happened to mention, because the ledger for that request is
 * gone — and that is the correct behaviour rather than an inconvenience. The
 * chat history sent up on each turn carries the user's and assistant's text
 * only, not tool results, so "the model saw this id once" is not evidence the
 * id is still real. Re-reading is cheap; acting on a remembered id is not.
 *
 * It wraps `IdWhitelist` rather than replacing it. That class has done this job
 * for `voice-intent` since 20260914 and was put in `security.ts` in Sprint 1
 * specifically for this moment; the wrapper adds the draft slot, the throwing
 * variant and the per-kind refusal, and nothing else. Note that `IdWhitelist`
 * already keys by an arbitrary string, so slots and rewards needed no change
 * there at all.
 */
export class DiscoveryLedger {
  private readonly ids = new IdWhitelist();
  /**
   * The draft a prepare tool left behind. The route reads this AFTER the loop
   * and persists it. Deliberately not returned to the model as an authority:
   * the model gets a fenced copy for its wording, but the row is written from
   * this object.
   *
   * One slot, not a list, so a turn cannot produce two proposals and leave the
   * customer with two cards and no idea which button does what. The last
   * prepare call wins, which is the one the model just told them about.
   */
  draft: AiProposalDraft | null = null;

  /**
   * AI Sprint 5. The recipient snapshot that goes with a campaign draft.
   *
   * Kept beside the draft rather than inside it, deliberately. The draft is
   * what becomes `ai_actions.display` and therefore what the owner's card
   * reads, and it carries a recipient COUNT. The ids live here, are read once
   * by the route, land in `campaign_recipients`, and never reach the model or
   * the browser — §5's "do not send unnecessary PII to Anthropic" expressed as
   * a place the ids cannot accidentally be rendered from.
   *
   * Null for the other three action types, which have no audience.
   */
  campaignRecipients: readonly string[] | null = null;

  /** Record ids a tool result offered. Called by the discovery tools. */
  offer(kind: LedgerKind, offered: readonly string[]): void {
    this.ids.offer(kind, offered);
  }

  /** Was this id in something we actually returned this request? */
  has(kind: LedgerKind, id: string): boolean {
    return this.ids.has(kind, id);
  }

  /**
   * The gate. Throws rather than returning false, because every caller's
   * correct response to "the model invented an id" is to stop — and a boolean
   * is a thing a future caller can forget to check.
   *
   * One unknown id invalidates the whole list. A partly-understood booking is
   * worse than an admitted misunderstanding: dropping the id the model got
   * wrong and proceeding with the rest would book something nobody asked for.
   */
  requireOffered(kind: LedgerKind, wanted: readonly string[]): void {
    if (wanted.length === 0 || !this.ids.allOffered(kind, wanted)) {
      throw new ProposalError(REFUSAL_FOR_KIND[kind]);
    }
  }

  /** For diagnostics and tests: which ids were not offered. */
  unknown(kind: LedgerKind, wanted: readonly string[]): string[] {
    return this.ids.unknown(kind, wanted);
  }
}

/**
 * An unguessable nonce.
 *
 * `crypto.getRandomValues` rather than `Math.random`: this is a credential, and
 * although RLS is what actually stops one customer reaching another's proposal,
 * a predictable second factor is not a second factor. Node 20+ and the Edge
 * runtime both provide `globalThis.crypto`, so there is no import.
 */
export function newProposalNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
