import "server-only";
import { z } from "zod";
import { isQueueModel } from "@/lib/business-model";
import { chairFreeAtMs, minutesUntil } from "@/lib/queue-wait";
import { canBookNow } from "@/lib/shop-availability";
import type { BusinessType } from "@/types";
import type { DiscoveryLedgerLike, ToolContext, ToolDefinition } from "../types";
import {
  AI_ACTION_JOIN_QUEUE,
  draftTotal,
  ProposalError,
  type JoinQueueDraft,
  type ProposalService,
} from "../proposals";

/**
 * `prepare_join_queue` — the assistant asking, never acting.
 *
 * ---------------------------------------------------------------------------
 * What it does, and why that is still read-only
 * ---------------------------------------------------------------------------
 * It writes nothing. It checks the ids the model named against the ids this
 * request's discovery tools actually returned, re-reads the shop and the
 * services, computes the wait from the live queue, and returns a description.
 *
 * The PROPOSED row is written afterwards by the route, from the draft this tool
 * leaves on the ledger. So `readOnly: true` is a statement of fact, and the
 * generic loop's refusal of non-read-only tools — the guard Sprint 1 built and
 * Sprint 2 finally tested — is untouched. Nothing about Sprint 3 required
 * weakening it, which was the point of putting the mutation outside the loop.
 *
 * ---------------------------------------------------------------------------
 * The order of the checks is the design
 * ---------------------------------------------------------------------------
 *   1. Were these ids OFFERED?   — before a single query runs
 *   2. Does the shop exist?      — under RLS, so "exists" means "visible"
 *   3. Is it a queue shop?       — via bookingModel(), so UNISEX qualifies
 *   4. Is it taking bookings?    — via shopAvailability(), the app's own rule
 *   5. Do the services belong to it, and are they active?
 *   6. Is the customer free to join?
 *
 * Check 1 comes first deliberately. A model that invented a uuid should not
 * cause a database lookup at all: refusing before the query means an invented
 * id cannot even be used to ask whether a shop exists.
 *
 * ---------------------------------------------------------------------------
 * None of this is the authority
 * ---------------------------------------------------------------------------
 * Every check here is repeated at confirmation time, and then repeated AGAIN by
 * `serial_before_insert` inside the write. That is not redundancy for its own
 * sake — the three happen at three different moments, and a shop can close
 * between any two of them. What this tool's checks buy is a confirmation card
 * that is accurate when it is shown, and a refusal the customer can act on
 * ("that shop is closed") instead of a failure after they have agreed.
 *
 * If this whole file were wrong, the insert would still be refused. That is the
 * property worth having.
 */

/** At most five services in one booking, matching the booking screen. */
const MAX_SERVICES = 5;

const ArgsSchema = z.object({
  shopId: z
    .string()
    .uuid()
    .describe(
      "The shop id, taken from a search_shops or search_services result in THIS conversation turn. An id you did not receive from a tool will be rejected.",
    ),
  serviceIds: z
    .array(z.string().uuid())
    .min(1)
    .max(MAX_SERVICES)
    .describe(
      "Service ids from a search_services result in THIS turn. They must all belong to the shop above.",
    ),
});

/**
 * Read the shop, and refuse anything that is not a queue this customer can
 * join. Split out so the confirm endpoint runs the identical checks rather than
 * a paraphrase of them — the two must not drift, because the whole claim of
 * "revalidated at confirmation" rests on them being the same rules.
 */
export async function loadJoinableShop(ctx: ToolContext, shopId: string) {
  const { data: shop, error } = await ctx.supabase
    .from("shops")
    .select("id, name, business_type, is_open, accepting_new, break_until")
    .eq("id", shopId)
    .maybeSingle();

  if (error) throw new ProposalError("UNAVAILABLE");
  if (!shop) throw new ProposalError("SHOP_NOT_FOUND");

  // A parlour has no queue to join. Sprint 4 adds appointment booking; until
  // then this is a refusal with a reason, not a failure.
  if (!isQueueModel(shop.business_type as BusinessType)) {
    throw new ProposalError("NOT_A_QUEUE_SHOP");
  }

  // `canBookNow`, which is the app's OWN answer to "can a customer take a
  // serial right now" — not a fresh reading of the same columns.
  //
  // The distinction matters and I had it wrong first time: a shop on a BREAK is
  // still joinable. Its own comment says so — "a break doesn't stop them, it
  // just pushes their ETA" — and the booking screen behaves that way. Refusing
  // during a break would have made the assistant stricter than the button next
  // to it, which is its own kind of wrong answer: the customer is told they
  // cannot join a queue they can plainly see themselves joining.
  if (!canBookNow(shop, ctx.now.getTime())) {
    throw new ProposalError("SHOP_NOT_ACCEPTING");
  }

  return shop;
}

/**
 * Read the services, and refuse any that is not this shop's and active.
 *
 * The prices come back with them, from `services.rate`. There is no argument
 * through which a caller could supply one, and the amount recorded against the
 * serial is computed by the insert trigger in any case — so the figure on the
 * card is the shop's, and the figure in the ledger is the shop's, and neither
 * passed through the model.
 */
export async function loadJoinableServices(
  ctx: ToolContext,
  shopId: string,
  serviceIds: readonly string[],
): Promise<ProposalService[]> {
  const { data, error } = await ctx.supabase
    .from("services")
    .select("id, shop_id, name, rate, default_duration_min, is_active")
    .in("id", [...serviceIds]);

  if (error) throw new ProposalError("UNAVAILABLE");

  const rows = data ?? [];
  // Every requested id must resolve. A missing one means the service was
  // deleted, or RLS will not show it — either way the booking the customer is
  // being asked to confirm is not the booking they would get.
  for (const id of serviceIds) {
    const row = rows.find((service) => service.id === id);
    if (!row) throw new ProposalError("SERVICE_NOT_FOUND");
    if (row.shop_id !== shopId) throw new ProposalError("SERVICE_WRONG_SHOP");
    if (!row.is_active) throw new ProposalError("SERVICE_INACTIVE");
  }

  // Ordered as the customer asked, not as Postgres returned them, so the card
  // lists them in the order the conversation established.
  return serviceIds.map((id) => {
    const row = rows.find((service) => service.id === id)!;
    return {
      serviceId: row.id,
      name: row.name,
      priceTaka: row.rate ?? null,
      durationMin: row.default_duration_min ?? null,
    };
  });
}

/**
 * Is this customer free to take a serial?
 *
 * The queue permits one active booking at a time
 * (`one_active_serial_per_customer`), and the index is what actually enforces
 * it. Checking here converts "your confirmation failed" into "you already have
 * a serial running", which is a thing the customer can do something about.
 */
export async function assertCustomerFree(ctx: ToolContext): Promise<void> {
  const { data, error } = await ctx.supabase
    .from("serials")
    .select("id")
    .eq("customer_id", ctx.userId)
    .in("status", ["WAITING", "IN_PROGRESS"])
    .limit(1);

  if (error) throw new ProposalError("UNAVAILABLE");
  if ((data ?? []).length > 0) throw new ProposalError("ALREADY_IN_QUEUE");
}

/**
 * The live queue for one shop, as minutes.
 *
 * `chairFreeAtMs` + `minutesUntil` — the explore card's arithmetic, not a
 * second opinion about it. If the card says twenty minutes and the assistant
 * says thirty, the customer stops believing both.
 */
export async function readQueueWait(
  ctx: ToolContext,
  shopId: string,
): Promise<{ estimatedWaitMin: number | null; waitingCount: number }> {
  const { data, error } = await ctx.supabase
    .from("queue_public")
    .select(
      "id, shop_id, chair_id, position, status, is_walk_in, estimated_duration_min, estimated_start_at, updated_at",
    )
    .eq("shop_id", shopId);

  if (error) throw new ProposalError("UNAVAILABLE");

  const rows = data ?? [];
  if (rows.length === 0) return { estimatedWaitMin: 0, waitingCount: 0 };

  const freeAt = chairFreeAtMs(rows, (row) => row.chair_id);
  return {
    // null when people are waiting but no estimate has been computed — which
    // the card renders as "unknown", never as zero.
    estimatedWaitMin: minutesUntil(freeAt.values(), ctx.now.getTime()),
    waitingCount: rows.length,
  };
}

/** Build the whole draft. Shared with the confirm endpoint's revalidation. */
export async function buildJoinQueueDraft(
  ctx: ToolContext,
  shopId: string,
  serviceIds: readonly string[],
): Promise<JoinQueueDraft> {
  const shop = await loadJoinableShop(ctx, shopId);
  const services = await loadJoinableServices(ctx, shopId, serviceIds);
  await assertCustomerFree(ctx);
  const { estimatedWaitMin, waitingCount } = await readQueueWait(ctx, shopId);

  return {
    action: AI_ACTION_JOIN_QUEUE,
    shopId: shop.id,
    shopName: shop.name,
    businessType: shop.business_type,
    services,
    totalTaka: draftTotal(services),
    estimatedWaitMin,
    waitingCount,
  };
}

const prepareJoinQueue: ToolDefinition<typeof ArgsSchema> = {
  name: "prepare_join_queue",
  description:
    "Prepare a queue-join for the customer to confirm. This does NOT join the queue and does NOT book anything — it checks the shop and services are still valid, reads the real price and the live wait, and produces a confirmation card the customer must approve themselves. " +
    "Only for queue-based shops (salon/unisex); a parlour takes appointments, which you cannot book. " +
    "Use the shop and service ids exactly as a search tool in this turn returned them — an id you were not given will be rejected. " +
    "After calling this, tell the customer what is on the card and that they need to confirm it. Never say they have joined.",
  readOnly: true,
  roles: ["customer"],
  schema: ArgsSchema,
  handler: async (args, ctx) => {
    const ledger = ctx.discovery as DiscoveryLedgerLike | undefined;
    // No ledger means no verified ids to check against, so nothing can be
    // proposed. This is the owner path, or a caller that forgot to build one —
    // either way refusing is the only safe answer.
    if (!ledger) throw new ProposalError("SHOP_NOT_OFFERED");

    // BEFORE any query: were these ids actually offered this request?
    ledger.requireOffered("shop", [args.shopId]);
    ledger.requireOffered("service", args.serviceIds);

    const draft = await buildJoinQueueDraft(ctx, args.shopId, args.serviceIds);

    // Left for the route, which persists it once the loop has finished. The
    // model gets the fenced copy below for its wording; the row is written
    // from this object, so the two cannot disagree.
    ledger.draft = draft;

    return {
      prepared: true,
      shop: { id: draft.shopId, name: draft.shopName },
      services: draft.services.map((service) => ({
        name: service.name,
        price_taka: service.priceTaka,
        duration_min: service.durationMin,
      })),
      total_taka: draft.totalTaka,
      estimated_wait_min: draft.estimatedWaitMin,
      waiting_count: draft.waitingCount,
      // Said in the payload, not only in the system prompt, so the model has it
      // as a fact from the tool rather than as a rule it might weigh against
      // the customer's insistence.
      note:
        "NOTHING HAS BEEN BOOKED. A confirmation card is now shown to the customer. " +
        "They must press confirm themselves. Tell them what it says and ask them to confirm — " +
        "do not say they are in the queue, and do not give them a serial number.",
    };
  },
};

export const JOIN_QUEUE_TOOLS: readonly ToolDefinition[] = [prepareJoinQueue];
