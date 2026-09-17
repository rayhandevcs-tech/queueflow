import "server-only";
import {
  AI_ACTION_BOOK_APPOINTMENT,
  AI_ACTION_JOIN_QUEUE,
  AI_ACTION_REDEEM_REWARD,
  AI_ACTION_SEND_CAMPAIGN,
  type AiActionType,
} from "../proposals";
import type { ActionExecutor } from "./contract";
import { joinQueueExecutor } from "./join-queue-action";
import { bookAppointmentExecutor } from "./book-appointment-action";
import { redeemRewardExecutor } from "./redeem-reward-action";
import { sendCampaignExecutor } from "./send-campaign-action";

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
 * A switch makes the refusal the visible default. Four cases and
 * `return null`, so a fifth action type — should one ever reach the enum
 * without an executor — is refused rather than falling through to whichever
 * entry happened to be first. The confirm endpoint settles such a row FAILED
 * and tells the caller nothing happened, which is true.
 *
 * Note what is NOT dispatchable: there is no path from a string in a request
 * body to any of these. The argument below comes from `action_type` on a row
 * written by `ai_action_propose()`, which is a Postgres enum with exactly four
 * members. The client sends a proposal id, a nonce, and — for a campaign only
 * — the owner's edited words, which select nothing.
 *
 * Sprint 5's addition is the first executor whose action belongs to an owner
 * rather than a customer, and it changes nothing structural: the branch still
 * comes from a column, the executor still calls exactly one existing business
 * function, and `send-campaign-action.ts` still cannot mark its own work
 * EXECUTED.
 */
export function executorFor(actionType: AiActionType | string): ActionExecutor | null {
  switch (actionType) {
    case AI_ACTION_JOIN_QUEUE:
      return joinQueueExecutor;
    case AI_ACTION_BOOK_APPOINTMENT:
      return bookAppointmentExecutor;
    case AI_ACTION_REDEEM_REWARD:
      return redeemRewardExecutor;
    case AI_ACTION_SEND_CAMPAIGN:
      return sendCampaignExecutor;
    default:
      return null;
  }
}
