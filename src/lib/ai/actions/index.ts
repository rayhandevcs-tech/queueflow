import "server-only";
import {
  AI_ACTION_BOOK_APPOINTMENT,
  AI_ACTION_JOIN_QUEUE,
  AI_ACTION_REDEEM_REWARD,
  type AiActionType,
} from "../proposals";
import type { ActionExecutor } from "./contract";
import { joinQueueExecutor } from "./join-queue-action";
import { bookAppointmentExecutor } from "./book-appointment-action";
import { redeemRewardExecutor } from "./redeem-reward-action";

export type { ActionExecutor, ActionOutcome, ConfirmedAction } from "./contract";

/**
 * Which executor performs which action — the closed dispatch.
 *
 * A `switch` rather than a lookup object, and not only because the brief asked
 * for one. A `Record<AiActionType, ActionExecutor>` would be exhaustive by the
 * type system, which is good, but it is also an object that can be indexed by
 * any string at runtime — and "the endpoint indexes a table with a value it was
 * handed" is the shape of the problem this whole architecture exists to avoid,
 * even where that value comes from a trusted column.
 *
 * A switch makes the refusal the visible default. Three cases and
 * `return null`, so a fourth action type — should one ever reach the enum
 * without an executor — is refused rather than falling through to whichever
 * entry happened to be first. The confirm endpoint settles such a row FAILED
 * and tells the customer nothing happened, which is true.
 *
 * Note what is NOT dispatchable: there is no path from a string in a request
 * body to any of these. The argument below comes from `action_type` on a row
 * written by `ai_action_propose()`, which is a Postgres enum with exactly three
 * members. The client sends a proposal id and a nonce.
 */
export function executorFor(actionType: AiActionType | string): ActionExecutor | null {
  switch (actionType) {
    case AI_ACTION_JOIN_QUEUE:
      return joinQueueExecutor;
    case AI_ACTION_BOOK_APPOINTMENT:
      return bookAppointmentExecutor;
    case AI_ACTION_REDEEM_REWARD:
      return redeemRewardExecutor;
    default:
      return null;
  }
}
