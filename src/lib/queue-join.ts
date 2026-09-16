import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * The one shape of a customer joining a queue.
 *
 * ---------------------------------------------------------------------------
 * Why this file exists
 * ---------------------------------------------------------------------------
 * Two callers now take a serial on a customer's behalf: the booking screen
 * (`customer-booking/api/booking.api.ts`, in the browser) and the AI's confirm
 * endpoint (`/api/ai/actions/confirm`, on the server). They differ in exactly
 * one respect — which Supabase client they hold — and in nothing else.
 *
 * Writing the insert twice would have been four lines each and completely fine
 * until the first time somebody changed one of them. Then there would be two
 * answers to "what does the app send when a customer joins a queue", the AI
 * path would be the one nobody remembered to update, and the difference would
 * surface as a booking that behaves subtly unlike every other booking.
 *
 * So the payload is built here, once, and both callers pass their own client.
 *
 * ---------------------------------------------------------------------------
 * What this file deliberately does NOT do
 * ---------------------------------------------------------------------------
 * It does not decide anything. Not the chair, not the position, not the price,
 * not the duration, not the status, not whether the shop is open, not whether
 * the services belong to that shop. Every one of those is decided by
 * `serial_before_insert` — a SECURITY DEFINER trigger that runs inside the
 * write, under advisory locks on the shop and the chair.
 *
 * That is worth being exact about, because it is the whole reason the AI can be
 * trusted with this at all. The trigger:
 *
 *   · refuses a shop that is closed or not accepting new bookings
 *   · refuses any service that is not active AND belonging to that shop
 *   · assigns the chair, or validates a chosen one and its capabilities
 *   · sets `status = 'WAITING'` and `booked_at = now()` itself
 *   · computes `services_snapshot` and `total_amount` from `services.rate`
 *
 * And around it, `serials: customer insert` (`auth.uid() = customer_id and
 * is_walk_in = false`) plus the `one_active_serial_per_customer` unique index.
 *
 * So the strongest statement about this module is a negative one: there is no
 * field here through which a caller — or a model that talked a caller into
 * something — could influence the price, the position or whose booking it is.
 * The only inputs are a shop, some services, an optional chair preference and
 * an optional travel time. Everything that matters is computed on the far side
 * of the trigger.
 */

/** Which client, and who the session says the caller is. */
export interface QueueJoinTarget {
  shopId: string;
  serviceIds: readonly string[];
  /**
   * From `auth.getUser()` in the browser or on the server. Never from a model,
   * never from a request body. RLS re-checks it against `auth.uid()` anyway,
   * so a wrong value here is refused rather than honoured.
   */
  customerId: string;
  /** For the board's card. Falls back below rather than inserting null. */
  customerName: string;
  /** Customer's chosen staff, or null to let the trigger pick. */
  chairId?: string | null;
  /** Minutes away, when Explore actually knows. null when it does not. */
  travelMin?: number | null;
  /** Advance payment, when the shop took one before the visit. */
  advance?: { method: "bkash" | "nagad"; transactionId: string } | null;
}

/** What the app has always sent. Nothing computed, nothing decided. */
export type QueueJoinInsert = Database["public"]["Tables"]["serials"]["Insert"];

/** The fallback name, matching what the booking screen has always used. */
export const QUEUE_JOIN_FALLBACK_NAME = "Customer";

/**
 * Build the row. Pure, so both callers and the tests agree on it by
 * construction rather than by review.
 *
 * `is_walk_in: false` is not a default worth overriding: the customer INSERT
 * policy requires it, and a walk-in is the shopkeeper's own action taken at the
 * counter. A customer-initiated walk-in is a contradiction the policy refuses.
 */
export function buildQueueJoinInsert(target: QueueJoinTarget): QueueJoinInsert {
  return {
    shop_id: target.shopId,
    customer_id: target.customerId,
    customer_name: target.customerName.trim() || QUEUE_JOIN_FALLBACK_NAME,
    service_ids: [...target.serviceIds],
    is_walk_in: false,
    chair_id: target.chairId ?? null,
    travel_min: target.travelMin ?? null,
    ...(target.advance
      ? {
          advance_paid: true,
          advance_method: target.advance.method,
          advance_txn_id: target.advance.transactionId,
          payment_status: "ADVANCE" as const,
        }
      : {}),
  };
}

/**
 * Perform the join with whichever client the caller holds.
 *
 * The client is a parameter for one reason: the browser path uses the anon
 * client with the user's session, and the AI path uses the cookie-bound server
 * client. Both are the CUSTOMER's session — neither is service-role, and there
 * is no overload of this function that takes one. If a future caller needs to
 * bypass RLS to make this work, the thing to change is the policy, in a
 * migration, where it can be reviewed.
 *
 * Errors are left raw on purpose. Both callers want them, but for different
 * things: the browser wraps them with `withDbErrors()` for a toast, and the
 * confirm endpoint maps them to an audit `failure_code` and a safe message.
 * Translating here would force one of them to un-translate.
 */
export async function joinQueue(
  supabase: SupabaseClient<Database>,
  target: QueueJoinTarget,
) {
  return supabase
    .from("serials")
    .insert(buildQueueJoinInsert(target))
    .select()
    .single();
}
