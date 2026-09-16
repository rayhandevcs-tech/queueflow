import "server-only";
import type { ToolContext } from "../types";
import type { AiActionType, AiProposalDraft } from "../proposals";

/**
 * What a confirmed action is, and what performing one looks like.
 *
 * ---------------------------------------------------------------------------
 * Why there are three executors and not one endpoint that does everything
 * ---------------------------------------------------------------------------
 * The tempting shape is a single confirm handler with three `if` branches, and
 * the shape after that is a generic one: take the action type, look up a
 * function by name, call it. That second step is the whole danger — the moment
 * an endpoint can dispatch by a name it was handed, the closed set of things
 * the assistant can cause stops being closed.
 *
 * So: each action type has its own module, with its own revalidation and its
 * own call to the app's own business function. The route switches on the
 * claimed row's `action_type` — a Postgres enum with exactly three members —
 * and refuses anything else. There is no table of function names, no string
 * that becomes a call, and nothing in a request body that selects a branch: the
 * branch comes from a column on a server-written row.
 *
 * ---------------------------------------------------------------------------
 * What an executor is allowed to be
 * ---------------------------------------------------------------------------
 * An executor may read, revalidate, and call ONE existing business function
 * (`joinQueue` → the `serials` insert, `book_appointment()`, `redeem_reward()`).
 * It must not implement business rules of its own: no second queue engine, no
 * second booking engine, no points arithmetic. If an executor is computing
 * something the database also computes, that is the bug.
 *
 * It also never writes `ai_actions`. Claiming and settling are the route's job,
 * so an executor cannot mark its own work EXECUTED — which is what keeps the
 * audit a record of what happened rather than of what was attempted.
 */

/**
 * A claimed action, as the executors see it.
 *
 * Every field came off the row `ai_action_claim()` returned, which was written
 * by `ai_action_propose()` from a verified draft. None of it came from the
 * request body: the client sends an id and a nonce, and nothing else.
 *
 * `shopId` is non-null here even though the column is nullable, because the
 * route refuses a row without one before an executor is reached — and
 * `ai_action_propose` now raises `ai_action_shop_required` besides.
 */
export interface ConfirmedAction {
  id: string;
  actionType: AiActionType;
  shopId: string;
  serviceIds: string[];
  /** Appointment parameters. Null for the other two types. */
  staffId: string | null;
  startsAt: string | null;
  /** Redemption parameter. Null for the other two types. */
  rewardId: string | null;
  /**
   * What the customer was SHOWN, frozen at propose time.
   *
   * Used for exactly one thing: comparing against freshly read figures, so a
   * price or a points cost that moved is refused rather than silently applied.
   * It is never the source of a value that gets written — those all come from
   * the revalidation read, or from the trigger inside the write.
   */
  display: AiProposalDraft | null;
}

/** The result of actually doing it. */
export interface ActionOutcome {
  /**
   * The id of the row the action created — a serial, an appointment or a
   * redemption. `ai_action_settle()` decides which column it lands in, from the
   * action's own type, so a caller cannot put it in the wrong one.
   */
  resultId: string;
  /**
   * What the UI is told. Read back from the created row wherever the value
   * matters (position, total, code, balance), because the point of this field
   * is that every figure in it is one the database produced.
   */
  payload: Record<string, unknown>;
  /** True when the outcome was recovered by `reconcile` rather than performed. */
  alreadyExecuted?: boolean;
}

export interface ActionExecutor {
  actionType: AiActionType;
  /**
   * Revalidate against live state, then perform. Throws `ProposalError` with a
   * code — and, for a refusal the database produced, an already-scrubbed
   * sentence in `detail`.
   */
  execute(ctx: ToolContext, action: ConfirmedAction): Promise<ActionOutcome>;
  /**
   * Heal a CONFIRMED row whose settle was lost, or return null.
   *
   * Only called when a confirmation arrives for a proposal that has already
   * been claimed. An executor returns an outcome ONLY when it can identify the
   * row this proposal created exactly — never on a best guess. An audit trail
   * with a gap is honest; one with a plausible-looking wrong answer is not.
   */
  reconcile(ctx: ToolContext, action: ConfirmedAction): Promise<ActionOutcome | null>;
}
