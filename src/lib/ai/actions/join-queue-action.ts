import "server-only";
import { joinQueue } from "@/lib/queue-join";
import { translateDbError } from "@/lib/supabase/db-errors";
import type { ToolContext } from "../types";
import { AI_ACTION_JOIN_QUEUE, ProposalError } from "../proposals";
import { buildJoinQueueDraft } from "../tools/join-queue-prepare";
import type { ActionExecutor, ActionOutcome, ConfirmedAction } from "./contract";

/**
 * JOIN_QUEUE — the Sprint 3 flow, moved here unchanged in substance.
 *
 * It used to sit inline in the confirm route. Sprint 4 gave that route two more
 * actions to dispatch, and three revalidation-and-write blocks in one handler
 * would have made the one thing worth reading — the dispatch, and its refusal
 * of anything unrecognised — the hardest thing to find.
 *
 * The invariant Sprint 3 established is unchanged and still tested: there is
 * ONE queue-writing implementation, `@/lib/queue-join`, and both the booking
 * screen and this file call it. No second insert, no privileged RPC, no
 * service-role.
 */

/**
 * Map the queue's refusal onto a code.
 *
 * `translateDbError` is consulted for the SENTENCE, never for the code: it
 * produces the app's own Bangla for a constraint name, which is what makes a
 * closed shop read the same whether the customer arrived by button or by
 * assistant. The code stored in the audit stays this layer's own vocabulary, so
 * no Postgres text is ever persisted or shown.
 */
function queueRefusal(error: unknown): ProposalError {
  const friendly = translateDbError(error);
  return new ProposalError("QUEUE_REFUSED", friendly.message || undefined);
}

export const joinQueueExecutor: ActionExecutor = {
  actionType: AI_ACTION_JOIN_QUEUE,

  async execute(ctx: ToolContext, action: ConfirmedAction): Promise<ActionOutcome> {
    // The SAME rules `prepare_join_queue` ran, from the same function, because
    // "revalidated" only means something if the second check is the first
    // check. The stored `display` figures are NOT consulted: the shop may have
    // closed, the service may have been switched off, and the customer may have
    // taken a serial elsewhere since they were asked.
    const fresh = await buildJoinQueueDraft(ctx, action.shopId, action.serviceIds);

    // `joinQueue` — the exact call the booking screen makes, with this
    // request's cookie-bound client. Not a privileged RPC, not service-role,
    // not a second implementation: the same row, the same
    // `serials: customer insert` policy, the same `serial_before_insert`
    // trigger computing the chair, the position, the snapshot and the amount.
    const { data: serial, error } = await joinQueue(ctx.supabase, {
      shopId: action.shopId,
      serviceIds: action.serviceIds,
      // From the session. There is no body field for this and no argument on
      // any tool — and RLS re-checks it against auth.uid() regardless.
      customerId: ctx.userId,
      // Blank on purpose, and this is a correction to Sprint 3 rather than a
      // shortcut. That version passed `user.user_metadata.full_name`, which
      // `serial_before_insert` then threw away: for `is_walk_in = false` the
      // trigger overwrites `customer_name` and `customer_phone` from
      // `profiles`, because those are what the phone number, the chat thread
      // and the history belong to. So the value never reached a row — and it
      // was read from user-writable metadata, which is exactly the sort of
      // field that should not be near a booking. `buildQueueJoinInsert`
      // substitutes its own placeholder to satisfy NOT NULL until the BEFORE
      // INSERT trigger replaces it.
      customerName: "",
    });

    if (error || !serial) throw queueRefusal(error);

    return {
      resultId: serial.id,
      // Real figures from the real row. `position` and `total_amount` were
      // computed by the trigger; the wait is re-read from the live queue.
      // Nothing here is the proposal's stored copy, and nothing is invented —
      // the rule against inventing a queue position is satisfied structurally,
      // because the position is a column.
      payload: {
        serial: {
          id: serial.id,
          position: serial.position,
          chairId: serial.chair_id,
          status: serial.status,
          totalTaka: serial.total_amount,
          estimatedStartAt: serial.estimated_start_at,
        },
        shop: { id: fresh.shopId, name: fresh.shopName },
        services: fresh.services.map((service) => ({
          name: service.name,
          priceTaka: service.priceTaka,
        })),
        estimatedWaitMin: fresh.estimatedWaitMin,
      },
    };
  },

  /**
   * The customer has one active serial at most
   * (`one_active_serial_per_customer`), so "their active serial at this shop"
   * identifies the row this proposal created rather than resembling it.
   */
  async reconcile(ctx: ToolContext, action: ConfirmedAction) {
    const { data: serials } = await ctx.supabase
      .from("serials")
      .select("id, position, chair_id, status, total_amount, estimated_start_at")
      .eq("customer_id", ctx.userId)
      .eq("shop_id", action.shopId)
      .in("status", ["WAITING", "IN_PROGRESS"])
      .limit(1);

    const serial = (serials ?? [])[0];
    if (!serial) return null;

    return {
      resultId: serial.id,
      alreadyExecuted: true,
      payload: {
        serial: {
          id: serial.id,
          position: serial.position,
          chairId: serial.chair_id,
          status: serial.status,
          totalTaka: serial.total_amount,
          estimatedStartAt: serial.estimated_start_at,
        },
      },
    };
  },
};
