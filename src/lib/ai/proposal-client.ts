import { getBrowserClient } from "@/lib/supabase/client";
import type { AiProposalDraft, StoredProposal } from "./proposals";

/**
 * Reading and answering a proposal, from the browser.
 *
 * ---------------------------------------------------------------------------
 * Why this lives in `src/lib` rather than in a feature
 * ---------------------------------------------------------------------------
 * It was `src/features/customer-ai/api/proposals.api.ts`, which was the right
 * place while the customer's confirmation card was the only thing that read a
 * proposal. AI Sprint 5 gave the owner one too — a campaign approval card — and
 * `eslint-plugin-boundaries` allows `feature → same-feature` and nothing else,
 * so `provider-ai` may not import from `customer-ai`.
 *
 * That left two options, and they are the same two as Sprint 4's reward
 * eligibility: copy the three functions into the provider feature, or promote
 * them. Copying would mean two implementations of "confirm a proposal", and the
 * day they drifted one card would send a request the endpoint no longer
 * expected. So this moved here, and the customer feature's api file re-exports
 * it: every existing import keeps working, including that feature's tests, and
 * there is one answer to "how is a proposal confirmed".
 *
 * Deliberately NOT `server-only`, unlike everything else in this directory.
 * This is the browser half — it calls `getBrowserClient()` and `fetch` — and it
 * holds no key, no service role and no business logic.
 *
 * ---------------------------------------------------------------------------
 * Why a card fetches the row instead of being handed it
 * ---------------------------------------------------------------------------
 * The agent route returns only an id, in a header. Everything a card shows is
 * then read from `ai_actions` by this file, under RLS, which has two
 * consequences worth the extra round trip:
 *
 *   · the figures on the card are the figures the SERVER stored, not a payload
 *     that travelled through the client on its way to a confirm button — so
 *     there is nothing to tamper with between the proposal and the agreement;
 *   · RLS is the thing that decides whose proposal this is. Asking for somebody
 *     else's id gets no row, and no policy anywhere had to be written specially
 *     for the AI to make that true.
 *
 * ---------------------------------------------------------------------------
 * Confirming does NOT happen here
 * ---------------------------------------------------------------------------
 * There is no `serials` insert, no `book_appointment`, no `redeem_reward` and
 * no `broadcast_campaign` in this file, and there must not be. The confirm
 * button posts to `/api/ai/actions/confirm`, which claims the proposal
 * atomically, revalidates, and performs the one write server-side. Doing any of
 * it from the browser would put the replay guard and the revalidation on the
 * client's side of the trust boundary.
 */

/**
 * The shape the confirm endpoint answers with on success.
 *
 * One interface with optional result objects rather than a union, because the
 * CARD already knows which action it is rendering — it read the proposal's own
 * `display.action` — and the success payload's job is only to carry the figures
 * the database produced. A union here would make every read a narrow against
 * information the component already has.
 *
 * Every field is optional, which is deliberate: the executors read what they
 * created back and a failed read yields the id alone. A card hides what is
 * absent rather than filling it in, so a missing figure is never a
 * plausible-looking wrong one.
 */
export interface ConfirmSuccess {
  ok: true;
  alreadyExecuted?: boolean;
  actionType?: string;
  /** Set when a reconciled duplicate confirmation reported only the id. */
  resultId?: string | null;

  /** JOIN_QUEUE. */
  serial?: {
    id: string;
    position?: number;
    chairId?: string | null;
    status?: string;
    totalTaka?: number;
    estimatedStartAt?: string | null;
  };

  /** BOOK_APPOINTMENT — every figure from the `appointments` row. */
  appointment?: {
    id: string;
    startsAt?: string | null;
    endsAt?: string | null;
    status?: string | null;
    totalTaka?: number | null;
  };
  staff?: { id?: string; name?: string };
  durationMin?: number;

  /** REDEEM_REWARD — every figure from `redeem_reward()`'s own return. */
  redemption?: {
    id: string;
    code?: string;
    pointsSpent?: number;
    balanceAfter?: number;
    validUntil?: string | null;
  };
  reward?: {
    name?: string;
    kind?: string;
    value?: number | null;
    freeService?: string | null;
  };

  /**
   * SEND_CAMPAIGN — the two counts, both real and both reported.
   *
   * `recipientCount` is who was approved; `sentCount` is how many
   * notifications the insert actually created. They differ when somebody muted
   * promotions between the proposal and the send, and the card shows the
   * smaller, true figure — collapsing them would mean either overstating the
   * delivery or hiding the opt-out.
   */
  campaign?: {
    segment?: string | null;
    recipientCount?: number;
    sentCount?: number;
    title?: string | null;
    body?: string | null;
  };

  shop?: { id: string; name: string };
  services?: Array<{ name: string; priceTaka: number | null; durationMin?: number | null }>;
  estimatedWaitMin?: number | null;
}

/** And on refusal. `code` is a closed vocabulary; `message` is Bangla. */
export interface ConfirmFailure {
  ok: false;
  code: string;
  message?: string;
}

/**
 * The stored proposal, as a card needs it.
 *
 * `display` is the frozen snapshot of what the person is being shown. For a
 * queue join it is deliberately NOT authoritative for money — the amount
 * recorded against the serial is computed by `serial_before_insert` from
 * `services.rate` at insert time, and the success response reports that figure.
 * This is "what were they looking at when they agreed".
 *
 * `campaign_recipients` is deliberately absent from the selection. The owner's
 * card shows a COUNT, which travels in `display`; the snapshot itself is
 * server-side state and the browser has no use for it. Not selecting it is how
 * that stays true rather than being a habit.
 */
export async function getProposal(actionId: string): Promise<StoredProposal | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("ai_actions")
    .select(
      "id, status, action_type, shop_id, service_ids, nonce, display, expires_at, created_at, staff_id, starts_at, reward_id, campaign_segment, campaign_since, campaign_title, campaign_body, campaign_sent_count, serial_id, appointment_id, redemption_id, failure_code",
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
    display: (data.display as unknown as AiProposalDraft | null) ?? null,
    expiresAt: data.expires_at,
    createdAt: data.created_at,
    staffId: data.staff_id,
    startsAt: data.starts_at,
    rewardId: data.reward_id,
    campaignSegment: data.campaign_segment,
    campaignSince: data.campaign_since,
    campaignTitle: data.campaign_title,
    campaignBody: data.campaign_body,
    serialId: data.serial_id,
    appointmentId: data.appointment_id,
    redemptionId: data.redemption_id,
    campaignSentCount: data.campaign_sent_count,
    failureCode: data.failure_code,
  };
}

/**
 * Confirm. The only path that performs any of the four actions, and it is
 * server-side.
 *
 * `campaign` carries the owner's edited wording when they changed it, and it is
 * the only content this client ever sends. Everything else the endpoint needs —
 * the shop, the segment, the audience, the action type — it reads off the
 * stored row, so there is nothing else here to get wrong or to tamper with.
 */
export async function confirmProposal(
  actionId: string,
  nonce: string,
  campaign?: { title: string; body: string },
): Promise<ConfirmSuccess | ConfirmFailure> {
  const res = await fetch("/api/ai/actions/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actionId, nonce, ...(campaign ? { campaign } : {}) }),
  });

  const body = (await res.json().catch(() => null)) as
    | ConfirmSuccess
    | ConfirmFailure
    | null;

  // A body that will not parse is still a failure, and must not read as one
  // that succeeded. Defaulting to `ok: false` is the safe direction: the worst
  // outcome of a false failure is somebody checking their own screen; the worst
  // outcome of a false success is a customer not turning up, or an owner
  // believing a campaign went out when it did not.
  if (!body) return { ok: false, code: "UNAVAILABLE" };
  return body;
}

/** Decline. Cannot perform anything — see the endpoint. */
export async function cancelProposal(actionId: string): Promise<boolean> {
  const res = await fetch("/api/ai/actions/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actionId }),
  });
  return res.ok;
}
