import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  buildCustomerBrief,
  type BriefActiveSerial,
  type CustomerBrief,
} from "../lib/build-customer-brief";

export const NOT_SIGNED_IN = "NOT_SIGNED_IN";

/** A year of history — enough for "where do I usually go", small enough to send. */
function since(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString();
}

function serviceNames(snapshot: unknown): string[] {
  if (!Array.isArray(snapshot)) return [];
  return snapshot
    .map((s) => (s && typeof s === "object" && "name" in s ? String(s.name) : null))
    .filter((n): n is string => !!n);
}

/**
 * Read the caller's own bookings and reduce them to a brief.
 *
 * Everything goes through the cookie-bound client, so RLS is what limits this
 * to one customer's rows. The shop name comes from an embed rather than a
 * separate lookup because shops are publicly readable anyway — there is nothing
 * here a customer could not already see on their own serial screen.
 */
export async function gatherCustomerBrief(): Promise<CustomerBrief> {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(NOT_SIGNED_IN);

  const [profile, serials] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("serials")
      .select(
        "id, chair_id, position, status, payment_status, total_amount, due_amount, estimated_start_at, started_at, estimated_duration_min, called_at, arrived_at, is_walk_in, services_snapshot, completed_at, created_at, shops(name)",
      )
      .eq("customer_id", user.id)
      .gte("created_at", since())
      .order("created_at", { ascending: false }),
  ]);

  const rows = serials.data ?? [];
  const shopName = (row: (typeof rows)[number]) => {
    const shop = Array.isArray(row.shops) ? row.shops[0] : row.shops;
    return shop?.name ?? null;
  };

  const live = rows.find((r) => r.status === "WAITING" || r.status === "IN_PROGRESS");

  let activeBooking: BriefActiveSerial | null = null;
  if (live) {
    // How many are genuinely in front of them on the same chair. This is the
    // single most asked question, and computing it here means the model
    // reports a number rather than reasoning its way to one.
    const { count } = await supabase
      .from("queue_public")
      .select("id", { count: "exact", head: true })
      .eq("chair_id", live.chair_id)
      .in("status", ["WAITING", "IN_PROGRESS"])
      .lt("position", live.position);

    activeBooking = {
      position: live.position,
      status: live.status,
      estimated_start_at: live.estimated_start_at,
      started_at: live.started_at,
      estimated_duration_min: live.estimated_duration_min,
      called_at: live.called_at,
      arrived_at: live.arrived_at,
      is_walk_in: live.is_walk_in,
      shop_name: shopName(live),
      services: serviceNames(live.services_snapshot),
      total_amount: live.total_amount,
      aheadOnChair: count ?? 0,
    };
  }

  return buildCustomerBrief({
    name: profile.data?.full_name ?? null,
    activeBooking,
    history: rows.map((r) => ({
      completed_at: r.completed_at,
      status: r.status,
      payment_status: r.payment_status,
      total_amount: r.total_amount,
      due_amount: r.due_amount,
      shop_name: shopName(r),
      services: serviceNames(r.services_snapshot),
    })),
  });
}
