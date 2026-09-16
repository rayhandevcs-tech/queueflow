import { getBrowserClient } from "@/lib/supabase/client";
import type { JoinQueueDraft, StoredProposal } from "@/lib/ai/proposals";

/**
 * Reading and answering a proposal, from the browser.
 *
 * ---------------------------------------------------------------------------
 * Why the card fetches the row instead of being handed it
 * ---------------------------------------------------------------------------
 * The agent route returns only an id, in a header. Everything the card shows
 * is then read from `ai_actions` by this file, under RLS, which has two
 * consequences worth the extra round trip:
 *
 *   · the figures on the card are the figures the SERVER stored, not a payload
 *     that travelled through the client on its way to a confirm button — so
 *     there is nothing to tamper with between the proposal and the agreement;
 *   · RLS is the thing that decides whose proposal this is. A customer asking
 *     for somebody else's id gets no row, and no policy anywhere had to be
 *     written specially for the AI to make that true.
 *
 * ---------------------------------------------------------------------------
 * Confirming does NOT happen here
 * ---------------------------------------------------------------------------
 * There is no `serials` insert in this file, and there must not be. The confirm
 * button posts to `/api/ai/actions/confirm`, which claims the proposal
 * atomically, revalidates, and performs the join server-side. Doing it from the
 * browser would mean the replay guard and the revalidation lived on the
 * client's side of the trust boundary.
 */

/** The shape the confirm endpoint answers with on success. */
export interface ConfirmSuccess {
  ok: true;
  alreadyExecuted?: boolean;
  serial: {
    id: string;
    position?: number;
    chairId?: string | null;
    status?: string;
    totalTaka?: number;
    estimatedStartAt?: string | null;
  };
  shop?: { id: string; name: string };
  services?: Array<{ name: string; priceTaka: number | null }>;
  estimatedWaitMin?: number | null;
}

/** And on refusal. `code` is a closed vocabulary; `message` is Bangla. */
export interface ConfirmFailure {
  ok: false;
  code: string;
  message?: string;
}

/**
 * The stored proposal, as the card needs it.
 *
 * `display` is the frozen snapshot of what the customer is being shown. It is
 * deliberately NOT treated as authoritative for money: the amount recorded
 * against the serial is computed by `serial_before_insert` from `services.rate`
 * at insert time, and the success response reports that figure rather than this
 * one. This is "what were they looking at when they agreed".
 */
export async function getProposal(actionId: string): Promise<StoredProposal | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("ai_actions")
    .select(
      "id, status, action_type, shop_id, service_ids, nonce, display, expires_at, created_at, serial_id, failure_code",
    )
    .eq("id", actionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    status: data.status,
    actionType: data.action_type,
    shopId: data.shop_id,
    serviceIds: data.service_ids,
    nonce: data.nonce,
    display: (data.display as unknown as JoinQueueDraft | null) ?? null,
    expiresAt: data.expires_at,
    createdAt: data.created_at,
    serialId: data.serial_id,
    failureCode: data.failure_code,
  };
}

/** Confirm. The only path that writes a serial, and it is server-side. */
export async function confirmProposal(
  actionId: string,
  nonce: string,
): Promise<ConfirmSuccess | ConfirmFailure> {
  const res = await fetch("/api/ai/actions/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actionId, nonce }),
  });

  const body = (await res.json().catch(() => null)) as
    | ConfirmSuccess
    | ConfirmFailure
    | null;

  // A body that will not parse is still a failure, and must not read as one
  // that succeeded. Defaulting to `ok: false` is the safe direction: the worst
  // outcome of a false failure is the customer checking their serial screen;
  // the worst outcome of a false success is them not turning up.
  if (!body) return { ok: false, code: "UNAVAILABLE" };
  return body;
}

/** Decline. Cannot write a serial — see the endpoint. */
export async function cancelProposal(actionId: string): Promise<boolean> {
  const res = await fetch("/api/ai/actions/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actionId }),
  });
  return res.ok;
}
