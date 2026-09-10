import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
import type { CustomerMembership, Shop } from "@/types";

/**
 * Who is a member, and of what.
 *
 * Every read here is shop- or customer-scoped by RLS, not by the `eq()` that
 * happens to be in the query: `memberships: customer or owner read` returns
 * nothing for a shop you don't own or a customer you aren't. The filters are
 * here for the indexes.
 */

/** The owner's members list. Newest first — the ranking happens client-side. */
export async function getShopMemberships(shopId: string): Promise<CustomerMembership[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("customer_memberships")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * The signed-in customer's memberships, across every shop.
 *
 * Across shops is a *display* choice, not a scoping one: each row still
 * belongs to exactly one shop and says nothing about any other. The profile
 * page lists them side by side; nothing merges them.
 */
export async function getMyMemberships(): Promise<CustomerMembership[]> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("customer_memberships")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Ask to join a shop's programme.
 *
 * Sends the tier and nothing else — price, duration, benefits and the
 * customer's own name all come from the server (`membership_before_insert`),
 * and `payment_status` is forced to DUE for anyone who isn't the shop owner.
 * A customer cannot enrol themselves as paid because no real payment happened.
 *
 * No pre-check for "am I already a member": the partial unique index decides,
 * exactly as the appointment exclusion constraint does (decision 43). Two
 * taps that race produce one membership and one clear refusal.
 */
export async function requestMembership(
  shopId: string,
  tierId: string,
): Promise<CustomerMembership> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("not signed in");

    const { data, error } = await supabase
      .from("customer_memberships")
      .insert({
        shop_id: shopId,
        customer_id: user.id,
        tier_id: tierId,
        status: "PENDING",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

/**
 * The owner selling a membership across the counter.
 *
 * Goes straight to ACTIVE, because the owner is standing there and has either
 * taken the money or decided to let it stand — which is the same yes/no
 * question the queue and the appointment board ask when a job is finished.
 */
export async function enrollMember(input: {
  shopId: string;
  customerId: string;
  tierId: string;
  payment: { method: string } | { due: true };
  note?: string | null;
}): Promise<CustomerMembership> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const method = "method" in input.payment ? input.payment.method : null;
    const { data, error } = await supabase
      .from("customer_memberships")
      .insert({
        shop_id: input.shopId,
        customer_id: input.customerId,
        tier_id: input.tierId,
        status: "ACTIVE",
        payment_status: method ? "PAID" : "DUE",
        payment_method: method,
        note: input.note?.trim() || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

/**
 * Turn a customer's request into a real membership.
 *
 * The term starts now, not when they asked: `membership_before_update()`
 * stamps `started_at` and computes `expires_at` from the duration frozen on
 * the row. A request that sat for a week does not cost the customer a week.
 */
export async function activateMembership(
  membershipId: string,
  payment: { method: string } | { due: true },
): Promise<CustomerMembership> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const method = "method" in payment ? payment.method : null;
    const { data, error } = await supabase
      .from("customer_memberships")
      .update({
        status: "ACTIVE",
        payment_status: method ? "PAID" : "DUE",
        payment_method: method,
      })
      .eq("id", membershipId)
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

/** The money turned up later — the due-ledger move, for a membership. */
export async function markMembershipPaid(
  membershipId: string,
  method: string,
): Promise<CustomerMembership> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from("customer_memberships")
      .update({ payment_status: "PAID", payment_method: method })
      .eq("id", membershipId)
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

/**
 * End a membership.
 *
 * The same call for both sides — the owner cancelling a member and a customer
 * leaving are the same transition, and RLS is what makes them different: the
 * customer's UPDATE policy accepts only `status = 'CANCELLED'`, so this is
 * the one write they have. The row survives; there is no DELETE policy for
 * anybody, because a membership is a money record.
 */
export async function cancelMembership(
  membershipId: string,
  reason?: string | null,
): Promise<CustomerMembership> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from("customer_memberships")
      .update({ status: "CANCELLED", ...(reason ? { cancel_reason: reason } : {}) })
      .eq("id", membershipId)
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

export interface MembershipSummary {
  activeCount: number;
  pendingCount: number;
  expiringSoon: number;
  unpaidCount: number;
}

/**
 * Four numbers for the top of the owner's page.
 *
 * A SECURITY INVOKER RPC, so RLS still decides what it can count — another
 * shop's owner gets four zeros rather than a permission error. Not "advanced
 * analytics" (out of scope): it is the count that belongs above a list.
 */
export async function getMembershipSummary(shopId: string): Promise<MembershipSummary> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("shop_membership_summary", {
    p_shop_id: shopId,
  });
  if (error) throw error;
  const row = data?.[0];
  return {
    activeCount: row?.active_count ?? 0,
    pendingCount: row?.pending_count ?? 0,
    expiringSoon: row?.expiring_soon ?? 0,
    unpaidCount: row?.unpaid_count ?? 0,
  };
}

export interface ShopCustomerOption {
  id: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
}

/**
 * People this shop has actually served, for the counter-enrolment picker.
 *
 * Read from the shop's own work rows rather than from `profiles`, for two
 * reasons: `profiles` has no cross-user read policy (which is why serials and
 * appointments snapshot the name in the first place), and "everyone with an
 * account" is the wrong list — an owner is enrolling a regular, not searching
 * the country.
 *
 * Both tables are read because a shop is one or the other: a salon fills
 * `serials`, a parlour fills `appointments`. Asking the business type first
 * and reading only one would break the moment a unisex shop did both.
 */
export async function getShopCustomers(shopId: string): Promise<ShopCustomerOption[]> {
  const supabase = getBrowserClient();
  const [serials, appointments] = await Promise.all([
    supabase
      .from("serials")
      .select("customer_id, customer_name, customer_phone, customer_avatar_url")
      .eq("shop_id", shopId)
      .not("customer_id", "is", null),
    supabase
      .from("appointments")
      .select("customer_id, customer_name, customer_phone, customer_avatar_url")
      .eq("shop_id", shopId)
      .not("customer_id", "is", null),
  ]);

  // A shop whose appointments table is empty (or whose deploy predates it) is
  // not an error — it just has no parlour side.
  if (serials.error && appointments.error) throw serials.error;

  const byId = new Map<string, ShopCustomerOption>();
  for (const row of [...(serials.data ?? []), ...(appointments.data ?? [])]) {
    if (!row.customer_id || byId.has(row.customer_id)) continue;
    byId.set(row.customer_id, {
      id: row.customer_id,
      name: row.customer_name || "",
      phone: row.customer_phone,
      avatarUrl: row.customer_avatar_url,
    });
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "bn"));
}

/**
 * The shops a customer holds memberships at, for their profile card.
 *
 * A tiny `in()` query rather than a prop from the profile page: that page's
 * shop map is built from its *visit* history, and a customer can hold a
 * membership somewhere they have not been served yet (they joined, they have
 * not sat down). Loading the handful of ids the memberships actually name is
 * both correct and smaller.
 */
export async function getShopsByIds(shopIds: string[]): Promise<Shop[]> {
  if (shopIds.length === 0) return [];
  const supabase = getBrowserClient();
  const { data, error } = await supabase.from("shops").select("*").in("id", shopIds);
  if (error) throw error;
  return data ?? [];
}
