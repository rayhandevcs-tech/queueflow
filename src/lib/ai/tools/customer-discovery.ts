import "server-only";
import { z } from "zod";
import { bookingModel, isQueueModel } from "@/lib/business-model";
import { catalogueOrFilter } from "@/lib/shop-catalogue";
import { chairFreeAtMs, minutesUntil } from "@/lib/queue-wait";
import { SERVICE_CATEGORIES } from "@/config/constants";
import type { BusinessType } from "@/types";
import type { ToolContext, ToolDefinition } from "../types";
import { slotKey } from "../proposals";
import { ToolArgumentError } from "./owner-analytics";

/**
 * The customer's read-only discovery tools.
 *
 * ---------------------------------------------------------------------------
 * Read-only, and the registry is what enforces it
 * ---------------------------------------------------------------------------
 * Every tool here sets `readOnly: true`, and `agent-loop.ts` refuses to run a
 * tool that has not. So this sprint cannot join a queue, book an appointment,
 * redeem a reward or write anything at all — not because the prompt asks the
 * model nicely, but because there is no code path from a model's decision to a
 * write. Sprint 3 adds the first one deliberately, with a confirmation step.
 *
 * ---------------------------------------------------------------------------
 * Whose data, decided before the model speaks
 * ---------------------------------------------------------------------------
 * `get_customer_history` takes NO customer id. There is no argument through
 * which the model could name somebody; it reads `ctx.userId`, which came from
 * `auth.getUser()` in the route. And `serials` RLS would refuse another
 * customer's rows even if this file were wrong, which is the belt to that
 * brace.
 *
 * ---------------------------------------------------------------------------
 * Nothing computed twice
 * ---------------------------------------------------------------------------
 * The wait estimate comes from `chairFreeAtMs` and `minutesUntil` in
 * `@/lib/queue-wait` — the exact helpers the explore list and the shop page
 * use, whose own comment says they exist "so both use identical math". If the
 * assistant quoted a different wait than the card the customer is looking at,
 * both numbers would stop being believable.
 *
 * Availability comes from `shop_available_slots()`, which already accounts for
 * shop hours, staff schedules, time off, existing bookings and the canonical
 * service duration. There is no second availability calculation here and there
 * must never be.
 *
 * ---------------------------------------------------------------------------
 * Why these query tables rather than importing the explore feature's api
 * ---------------------------------------------------------------------------
 * `customer-explore/api/shops.api.ts` and `services.api.ts` are the same reads,
 * but they use `getBrowserClient()` — they exist to feed React Query in a
 * component. The agent runs on the server against the cookie-bound client,
 * which is what applies RLS to a request with no browser. Boundaries also
 * forbid `src/lib` importing a feature.
 *
 * So the same tables, the same filters, the same `is_open`/`is_active` rules —
 * separate call sites, not a separate source of truth. In particular the
 * service rows here come from `services` itself, so the price the assistant
 * quotes is the price the shop set, never a copy.
 */

// ---------------------------------------------------------------------------
// Shared argument pieces
// ---------------------------------------------------------------------------

/**
 * How a customer's question names a kind of business.
 *
 * `ANY` is the default rather than the customer's stored preference, and that
 * is deliberate: the preference decides what their HOME screen shows, and it
 * must not decide what the assistant is able to find. Asked "আজ salon-এ যেতে
 * চাই", a parlour-preferring customer gets salons. The route passes the
 * preference into the system prompt as context the model may lean on for an
 * unqualified question — it is a tie-breaker, not a filter.
 */
const BusinessKind = z
  .enum(["SALON", "PARLOUR", "ANY"])
  .optional()
  .describe(
    "SALON for barbershop/salon (queue-based, includes unisex), PARLOUR for " +
      "beauty parlour (appointment-based), ANY when the customer did not say. " +
      "Default ANY — do not narrow this from the customer's stored preference.",
  );

/** Keeps a model from asking for the whole platform. */
const Limit = z
  .number()
  .int()
  .min(1)
  .max(10)
  .optional()
  .describe("How many results to return. Default 6, hard maximum 10.");

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 10;
const HISTORY_DEFAULT = 5;
const HISTORY_MAX = 10;
/** Slots are dense — a day can hold dozens, and the model needs a sample. */
const MAX_SLOTS = 12;

function clampLimit(value: number | undefined, fallback = DEFAULT_LIMIT): number {
  if (value === undefined) return fallback;
  return Math.min(Math.max(1, Math.trunc(value)), MAX_LIMIT);
}

/**
 * Does this shop's model match what the customer asked for?
 *
 * Compared through `bookingModel()` rather than against the `business_type`
 * string, which is what makes UNISEX fall in with the salons automatically —
 * it runs the queue, so a customer asking for a salon should find it, and one
 * asking for a parlour should not be dropped into a queue they did not want.
 * No `if (business_type === "PARLOUR")` anywhere in this file.
 */
function matchesKind(type: BusinessType | null | undefined, kind: string | undefined): boolean {
  if (!kind || kind === "ANY") return true;
  const wanted = kind === "PARLOUR" ? "APPOINTMENT" : "QUEUE";
  return bookingModel(type) === wanted;
}

/** The public shop shape the model is allowed to see. Nothing private. */
interface ShopResult {
  id: string;
  name: string;
  business_type: string;
  women_only: boolean;
  address: string | null;
  rating: number | null;
  review_count: number;
}

// ---------------------------------------------------------------------------
// The tools
// ---------------------------------------------------------------------------

const searchShops: ToolDefinition = {
  name: "search_shops",
  description:
    "Find open shops by name, business kind or women-only. Returns public listing data only — no owner details, no private configuration. " +
    "There is NO location filter: this app has no authorised GPS context here, so never describe results as 'near you'. Read-only.",
  readOnly: true,
  roles: ["customer"],
  schema: z.object({
    query: z
      .string()
      .max(80)
      .optional()
      .describe("Free text matched against the shop's name. Omit to list by kind."),
    businessType: BusinessKind,
    womenOnly: z
      .boolean()
      .optional()
      .describe("True to return only women-only shops. Omit for no preference."),
    limit: Limit,
  }),
  handler: async (args, ctx) => {
    const { query, businessType, womenOnly, limit } = args as {
      query?: string;
      businessType?: string;
      womenOnly?: boolean;
      limit?: number;
    };
    const take = clampLimit(limit);

    // The same rule the explore catalogue uses — an appointment shop is
    // listed whatever its open switch says, because that switch is the
    // queue's. Shared through `catalogueOrFilter()` so the assistant can
    // never deny a parlour the map is drawing a pin for.
    let request = ctx.supabase
      .from("shops")
      .select("id, name, business_type, women_only, address")
      .or(catalogueOrFilter());

    if (query?.trim()) request = request.ilike("name", `%${query.trim()}%`);
    if (womenOnly === true) request = request.eq("women_only", true);

    // A generous ceiling before the in-memory kind filter, so narrowing to
    // parlours cannot come back empty just because the first `take` rows
    // happened to be salons. Still bounded — never "fetch every shop".
    const { data, error } = await request.order("name").limit(MAX_LIMIT * 4);
    if (error) throw error;

    const rows = (data ?? []).filter((shop) =>
      matchesKind(shop.business_type as BusinessType, businessType),
    );

    // Ratings in one batch for the rows that survived, not one query per shop.
    const ids = rows.slice(0, take).map((shop) => shop.id);
    const ratings = await ratingsFor(ctx, ids);

    const shops: ShopResult[] = rows.slice(0, take).map((shop) => ({
      id: shop.id,
      name: shop.name,
      business_type: shop.business_type,
      women_only: shop.women_only ?? false,
      address: shop.address ?? null,
      rating: ratings.get(shop.id)?.avg ?? null,
      review_count: ratings.get(shop.id)?.count ?? 0,
    }));

    // Record what was actually returned. This is the ONLY way a shop id
    // becomes proposable — `prepare_join_queue` checks against this ledger, so
    // a shop the model invented, remembered from an earlier turn, or read out
    // of injected text cannot reach the confirm path. Note the ids offered are
    // the ones RETURNED, not the ones queried: a row trimmed by the limit was
    // never shown to the model and must not become actionable.
    ctx.discovery?.offer("shop", shops.map((shop) => shop.id));

    return {
      shops,
      // So the model can describe its own scope honestly rather than claiming
      // "the shortest queue in Dhaka" from a sample of six.
      searched: rows.length,
      returned: shops.length,
      truncated: rows.length > shops.length,
      note: "This is a bounded search, not every shop on the platform. No location filtering was applied.",
    };
  },
};

/** Public rating summary, batched. Returns an empty map if unavailable. */
async function ratingsFor(
  ctx: ToolContext,
  shopIds: string[],
): Promise<Map<string, { avg: number; count: number }>> {
  const out = new Map<string, { avg: number; count: number }>();
  if (shopIds.length === 0) return out;

  // Best-effort: a shop with no reviews simply has no row, and a missing view
  // must not fail the whole search. `rating: null` then reads as "not rated",
  // which is true and different from a rating of zero.
  const { data } = await ctx.supabase
    .from("shop_rating_summary")
    .select("shop_id, avg_rating, review_count")
    .in("shop_id", shopIds);

  for (const row of data ?? []) {
    out.set(row.shop_id, { avg: row.avg_rating, count: row.review_count });
  }
  return out;
}

const searchServices: ToolDefinition = {
  name: "search_services",
  description:
    "Find services offered by open shops, with their real price and duration. Use this for 'facial', 'haircut', 'under 1500' and similar. " +
    "Price comes from the shop's own record — if it is missing, say so rather than estimating. Read-only.",
  readOnly: true,
  roles: ["customer"],
  schema: z.object({
    query: z
      .string()
      .max(80)
      .optional()
      .describe("Free text matched against the service's name, e.g. 'facial', 'haircut'."),
    category: z
      .enum(SERVICE_CATEGORIES)
      .optional()
      .describe("Filter by the app's own service category."),
    maxPrice: z
      .number()
      .positive()
      .max(1_000_000)
      .optional()
      .describe(
        "Taka ceiling, applied by the DATABASE against the real price. Use this for 'under 1500' rather than filtering the results yourself.",
      ),
    businessType: BusinessKind,
    limit: Limit,
  }),
  handler: async (args, ctx) => {
    const { query, category, maxPrice, businessType, limit } = args as {
      query?: string;
      category?: string;
      maxPrice?: number;
      businessType?: string;
      limit?: number;
    };
    const take = clampLimit(limit);

    // Joined to the shop so a result carries its context, and so the kind
    // filter and the catalogue-visibility rule can both be applied.
    let request = ctx.supabase
      .from("services")
      .select(
        "id, shop_id, name, category, rate, default_duration_min, shops!inner(id, name, business_type, women_only, address, is_open)",
      )
      .eq("is_active", true)
      .or(catalogueOrFilter(), { referencedTable: "shops" });

    if (query?.trim()) request = request.ilike("name", `%${query.trim()}%`);
    if (category) request = request.eq("category", category);
    // The price filter is the database's job, not the model's. Asked for
    // "facial under 1500", a model filtering a truncated list would quietly
    // miss the cheap one that fell off the end.
    if (maxPrice !== undefined) request = request.lte("rate", maxPrice);

    const { data, error } = await request.order("rate").limit(MAX_LIMIT * 4);
    if (error) throw error;

    type Joined = {
      id: string;
      shop_id: string;
      name: string;
      category: string | null;
      rate: number | null;
      default_duration_min: number | null;
      shops: {
        id: string;
        name: string;
        business_type: string;
        women_only: boolean | null;
        address: string | null;
      } | null;
    };

    const rows = ((data ?? []) as unknown as Joined[])
      .filter((row) => row.shops !== null)
      .filter((row) => matchesKind(row.shops!.business_type as BusinessType, businessType));

    const services = rows.slice(0, take).map((row) => ({
      service_id: row.id,
      name: row.name,
      category: row.category,
      // Null, never a guess. The prompt forbids inventing one and this is what
      // makes "unavailable" a thing the model can actually see.
      price_taka: row.rate ?? null,
      duration_min: row.default_duration_min ?? null,
      shop: {
        id: row.shops!.id,
        name: row.shops!.name,
        business_type: row.shops!.business_type,
        women_only: row.shops!.women_only ?? false,
        address: row.shops!.address ?? null,
      },
    }));

    // Both kinds, because a service result carries its shop — and a customer
    // who found a shop through its haircut should be able to join that queue
    // without searching for the shop again.
    ctx.discovery?.offer("service", services.map((service) => service.service_id));
    ctx.discovery?.offer("shop", services.map((service) => service.shop.id));

    return {
      services,
      searched: rows.length,
      returned: services.length,
      truncated: rows.length > services.length,
      priceFilterApplied: maxPrice !== undefined,
    };
  },
};

const getQueueStatus: ToolDefinition = {
  name: "get_queue_status",
  description:
    "Live queue for named shops: how many are waiting and the estimated wait in minutes. " +
    "Queue-based shops only (salon/unisex) — a parlour takes appointments, so use get_available_slots for those. " +
    "Pass the shop ids from search_shops. Read-only.",
  readOnly: true,
  roles: ["customer"],
  schema: z.object({
    shopIds: z
      .array(z.string().uuid())
      .min(1)
      .max(MAX_LIMIT)
      .describe("Shop ids from a previous search_shops call. At most 10."),
  }),
  handler: async (args, ctx) => {
    const { shopIds } = args as { shopIds: string[] };

    // The shops first, so a parlour can be reported as "not a queue shop"
    // rather than silently returning a wait of zero.
    const { data: shops, error: shopsError } = await ctx.supabase
      .from("shops")
      .select("id, name, business_type, is_open, accepting_new")
      .in("id", shopIds);
    if (shopsError) throw shopsError;

    const queueShops = (shops ?? []).filter((shop) =>
      isQueueModel(shop.business_type as BusinessType),
    );
    const skipped = (shops ?? [])
      .filter((shop) => !isQueueModel(shop.business_type as BusinessType))
      .map((shop) => ({
        shop_id: shop.id,
        shop_name: shop.name,
        reason: "APPOINTMENT_SHOP — takes bookings, has no live queue",
      }));

    if (queueShops.length === 0) {
      return { shops: [], skipped, note: "None of those shops runs a live queue." };
    }

    // `queue_public` is the same PII-free view the explore list reads.
    const { data: rows, error } = await ctx.supabase
      .from("queue_public")
      .select(
        "id, shop_id, chair_id, position, status, is_walk_in, estimated_duration_min, estimated_start_at, updated_at",
      )
      .in(
        "shop_id",
        queueShops.map((shop) => shop.id),
      );
    if (error) throw error;

    const nowMs = ctx.now.getTime();
    const byShop = new Map<string, typeof rows>();
    for (const row of rows ?? []) {
      const list = byShop.get(row.shop_id) ?? [];
      list.push(row);
      byShop.set(row.shop_id, list);
    }

    const result = queueShops.map((shop) => {
      const shopRows = byShop.get(shop.id) ?? [];
      // Identical math to the explore card: soonest-free chair, in minutes.
      const freeAt = chairFreeAtMs(shopRows, (row) => row.chair_id);
      const waiting = shopRows.length;
      return {
        shop_id: shop.id,
        shop_name: shop.name,
        waiting_count: waiting,
        // Null when there is nobody in line — "no wait" and "could not be
        // calculated" are different answers, and 0 is the honest one here.
        estimated_wait_min: waiting === 0 ? 0 : minutesUntil(freeAt.values(), nowMs),
        accepting_new: shop.accepting_new ?? true,
        is_open: shop.is_open ?? false,
      };
    });

    // Deliberately NOT offering these ids into the ledger, which looks like an
    // omission and is the opposite.
    //
    // This tool takes shop ids FROM THE MODEL. If it fed them back in as
    // "offered", then a model that guessed a real uuid — or was handed one by
    // injected text — could launder it into proposable simply by asking for its
    // queue status. The ledger must only ever be filled by a tool that SEARCHED
    // and chose the rows itself. A legitimate flow is unaffected: the ids came
    // from search_shops or search_services, which offered them already.
    return {
      shops: result,
      skipped,
      note: "Wait estimates use the same calculation the app's own shop cards show.",
    };
  },
};

const getAvailableSlots: ToolDefinition = {
  name: "get_available_slots",
  description:
    "Free appointment times at one shop on one day, for the chosen services. For parlours (appointment-based shops). " +
    "Already accounts for opening hours, staff schedules, time off, existing bookings and each service's own duration. " +
    "Read-only — finding a slot does NOT book it.",
  readOnly: true,
  roles: ["customer"],
  schema: z.object({
    shopId: z.string().uuid().describe("Shop id from search_shops or search_services."),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .describe("The day to check, YYYY-MM-DD, in the shop's own timezone."),
    serviceIds: z
      .array(z.string().uuid())
      .min(1)
      .max(5)
      .describe("Service ids from search_services. Their durations decide slot length."),
    staffId: z
      .string()
      .uuid()
      .optional()
      .describe("Optional: a specific staff member. Omit for anyone available."),
  }),
  handler: async (args, ctx) => {
    const { shopId, date, serviceIds, staffId } = args as {
      shopId: string;
      date: string;
      serviceIds: string[];
      staffId?: string;
    };

    // Refuse a queue shop rather than returning an empty slot list, which
    // would read as "fully booked" when it means "does not work that way".
    const { data: shop } = await ctx.supabase
      .from("shops")
      .select("id, name, business_type")
      .eq("id", shopId)
      .maybeSingle();

    if (!shop) throw new ToolArgumentError("NO_SUCH_SHOP");
    if (isQueueModel(shop.business_type as BusinessType)) {
      throw new ToolArgumentError(
        "QUEUE_SHOP — this shop runs a live queue rather than appointments. Use get_queue_status instead.",
      );
    }

    // The existing availability engine. Service durations come from the
    // canonical `services.default_duration_min` inside the RPC — never from a
    // learned or averaged queue duration.
    const { data, error } = await ctx.supabase.rpc("shop_available_slots", {
      p_shop_id: shopId,
      p_date: date,
      p_service_ids: serviceIds,
      p_staff_id: staffId ?? null,
    });
    if (error) throw error;

    const slots = (data ?? []).slice(0, MAX_SLOTS).map((slot) => ({
      staff_id: slot.staff_id,
      staff_name: slot.staff_name,
      starts_at: slot.slot_start,
      ends_at: slot.slot_end,
    }));

    // Record the slots actually RETURNED, as the deterministic tuple
    // shop|staff|instant. This is the ONLY way a time becomes proposable —
    // `prepare_book_appointment` checks against this ledger before it queries
    // anything, so a time the model rounded, adjusted, remembered from an
    // earlier turn or read out of injected text cannot reach the confirm path.
    //
    // The ones RETURNED, not the ones found: a slot trimmed by MAX_SLOTS was
    // never shown to the model and must not become actionable.
    //
    // Unlike `search_shops`, this tool does NOT offer the shop id, for the same
    // reason `get_queue_status` does not — the shop id came FROM the model, so
    // feeding it back would let a guessed uuid launder itself into proposable
    // simply by asking for its free times. A legitimate flow is unaffected:
    // the id came from a search, which offered it already.
    ctx.discovery?.offer(
      "slot",
      slots.map((slot) => slotKey(shop.id, slot.staff_id, slot.starts_at)),
    );

    return {
      shop: { id: shop.id, name: shop.name },
      date,
      slots,
      total_found: (data ?? []).length,
      truncated: (data ?? []).length > slots.length,
      // Said explicitly so the model does not imply it has reserved anything.
      note:
        "These are currently free times. Nothing has been booked or held. " +
        "To offer one to the customer, call prepare_book_appointment with a staff_id and starts_at copied exactly from this list.",
    };
  },
};

const getCustomerHistory: ToolDefinition = {
  name: "get_customer_history",
  description:
    "The signed-in customer's OWN past visits — services taken, shops visited, dates. " +
    "Use for 'what did I get last time' or 'which shop did I go to'. Returns nothing if they have no history; say so rather than guessing. Read-only.",
  readOnly: true,
  roles: ["customer"],
  // Deliberately no customer id. There is no argument through which the model
  // could name somebody else, which is a stronger guarantee than validating
  // one would have been.
  schema: z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(HISTORY_MAX)
      .optional()
      .describe(`How many recent visits. Default ${HISTORY_DEFAULT}, maximum ${HISTORY_MAX}.`),
  }),
  handler: async (args, ctx) => {
    const { limit } = args as { limit?: number };
    const take = Math.min(Math.max(1, Math.trunc(limit ?? HISTORY_DEFAULT)), HISTORY_MAX);

    // `ctx.userId` is from auth.getUser(). The filter is belt-and-braces: the
    // `serials` policy already restricts this to the caller's own rows, so a
    // bug here still could not read anybody else's.
    const { data, error } = await ctx.supabase
      .from("serials")
      .select("id, shop_id, status, completed_at, created_at, total_amount, services_snapshot")
      .eq("customer_id", ctx.userId)
      .eq("status", "DONE")
      .order("completed_at", { ascending: false })
      .limit(take);
    if (error) throw error;

    const rows = data ?? [];
    const shopIds = [...new Set(rows.map((row) => row.shop_id))];

    const shopsById = new Map<string, { name: string; business_type: string }>();
    if (shopIds.length > 0) {
      const { data: shops } = await ctx.supabase
        .from("shops")
        .select("id, name, business_type")
        .in("id", shopIds);
      for (const shop of shops ?? []) {
        shopsById.set(shop.id, { name: shop.name, business_type: shop.business_type });
      }
    }

    const visits = rows.map((row) => {
      // The snapshot is what was actually bought, frozen at the time — not
      // today's service list, which may since have been renamed or repriced.
      const snapshot = Array.isArray(row.services_snapshot)
        ? (row.services_snapshot as Array<{ name?: string }>)
        : [];
      return {
        visited_at: row.completed_at ?? row.created_at,
        shop_name: shopsById.get(row.shop_id)?.name ?? null,
        shop_id: row.shop_id,
        services: snapshot.map((service) => service.name).filter(Boolean),
        amount_taka: row.total_amount,
      };
    });

    return {
      visits,
      count: visits.length,
      // Lets the model tell "you have never been" apart from "I could not
      // read it", which the prompt requires it to distinguish.
      hasHistory: visits.length > 0,
    };
  },
};

export const CUSTOMER_DISCOVERY_TOOLS: readonly ToolDefinition[] = [
  searchShops,
  searchServices,
  getQueueStatus,
  getAvailableSlots,
  getCustomerHistory,
];
