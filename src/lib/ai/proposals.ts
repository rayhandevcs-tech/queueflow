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
 *   the endpoint revalidates     →  and performs the ordinary queue insert
 *
 * Nothing in this file writes anything. It is pure: types, a ledger, and the
 * vocabulary of refusals. That is deliberate — it means the rules can be tested
 * directly, with no client, no key and no database, and it keeps the interesting
 * logic out of the route where it would be reachable only through HTTP.
 *
 * ---------------------------------------------------------------------------
 * Why `readOnly: true` on a tool called `prepare_join_queue` is honest
 * ---------------------------------------------------------------------------
 * Because it writes nothing. It validates ids, reads the shop, the services and
 * the live queue, and hands back a description. The PROPOSED row is written by
 * the route after the loop has finished, from the draft the tool left in the
 * ledger — so the persistence happens in code the model cannot call, cannot
 * influence the arguments of, and never sees the result of.
 *
 * This matters because the brief's line "do NOT simply register
 * join_queue(readOnly: false) and let the generic loop execute it" is not a
 * naming preference. The generic loop refuses non-read-only tools, and that
 * refusal is load-bearing (see `agent-readonly.test.ts`). Weakening it to make
 * this sprint work would have removed the guarantee that Sprint 1 and 2 rest
 * on. So the guard stays exactly as it was, and the mutation lives outside the
 * loop entirely.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** The only action this sprint can propose. */
export const AI_ACTION_JOIN_QUEUE = "JOIN_QUEUE" as const;
export type AiActionType = typeof AI_ACTION_JOIN_QUEUE;

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
 * Five minutes, and the number is a judgement about what the card SAYS rather
 * than about security. The wait estimate on it came from a live queue; after a
 * few minutes it is describing a shop that has moved on, and asking somebody to
 * agree to a stale number is the thing expiry exists to prevent.
 *
 * The database decides, not this constant: `ai_action_propose()` takes the TTL
 * as a bounded argument (30s–30min) and computes `expires_at` with `now()` on
 * the server, so a wrong clock or a tampered client cannot extend it.
 */
export const AI_PROPOSAL_TTL_SECONDS = 300;

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
 */
export type ProposalRefusal =
  /** The model named a shop no discovery tool in this request returned. */
  | "SHOP_NOT_OFFERED"
  /** The model named a service no discovery tool in this request returned. */
  | "SERVICE_NOT_OFFERED"
  /** The shop is gone, or RLS will not show it. */
  | "SHOP_NOT_FOUND"
  /** A parlour. Appointments are Sprint 4; there is no queue to join. */
  | "NOT_A_QUEUE_SHOP"
  /** Closed, on a break, or not taking new serials. */
  | "SHOP_NOT_ACCEPTING"
  /** A service id that does not exist or is not visible. */
  | "SERVICE_NOT_FOUND"
  /** The service belongs to a different shop than the one proposed. */
  | "SERVICE_WRONG_SHOP"
  /** Switched off by the shop. */
  | "SERVICE_INACTIVE"
  /** They already have a serial running — the queue permits one. */
  | "ALREADY_IN_QUEUE"
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
  /** The queue itself refused the insert. The audit keeps the reason. */
  | "QUEUE_REFUSED"
  /** Anything unforeseen. Never a raw message. */
  | "UNAVAILABLE";

/** Thrown by the prepare tool and the confirm path. Carries only a code. */
export class ProposalError extends Error {
  readonly code: ProposalRefusal;
  constructor(code: ProposalRefusal) {
    super(code);
    this.name = "ProposalError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// The draft
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
  durationMin: number | null;
}

/**
 * What the customer is about to be asked, assembled from verified reads.
 *
 * Every field here came from the database in the same request. The model chose
 * WHICH shop and WHICH services from what it had been offered; it supplied none
 * of the names, none of the prices and none of the wait.
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

/** The persisted proposal, as the card and the confirm path see it. */
export interface StoredProposal {
  id: string;
  status: AiActionStatus;
  actionType: AiActionType;
  shopId: string | null;
  serviceIds: string[];
  nonce: string;
  display: JoinQueueDraft | null;
  expiresAt: string;
  createdAt: string;
  serialId: string | null;
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

// ---------------------------------------------------------------------------
// The ledger
// ---------------------------------------------------------------------------

/**
 * What this request's tools actually returned, and the draft they produced.
 *
 * One of these is created per agent request and put on the `ToolContext`. The
 * discovery tools call `offer()` as they return rows; `prepare_join_queue`
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
 * specifically for this moment; the wrapper adds the draft slot and the
 * throwing variant, and nothing else.
 */
export class DiscoveryLedger {
  private readonly ids = new IdWhitelist();
  /**
   * The draft the prepare tool left behind. The route reads this AFTER the loop
   * and persists it. Deliberately not returned to the model as an authority:
   * the model gets a fenced copy for its wording, but the row is written from
   * this object.
   */
  draft: JoinQueueDraft | null = null;

  /** Record ids a tool result offered. Called by the discovery tools. */
  offer(kind: "shop" | "service", offered: readonly string[]): void {
    this.ids.offer(kind, offered);
  }

  /** Was this id in something we actually returned this request? */
  has(kind: "shop" | "service", id: string): boolean {
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
  requireOffered(kind: "shop" | "service", wanted: readonly string[]): void {
    if (wanted.length === 0 || !this.ids.allOffered(kind, wanted)) {
      throw new ProposalError(
        kind === "shop" ? "SHOP_NOT_OFFERED" : "SERVICE_NOT_OFFERED",
      );
    }
  }

  /** For diagnostics and tests: which ids were not offered. */
  unknown(kind: "shop" | "service", wanted: readonly string[]): string[] {
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
