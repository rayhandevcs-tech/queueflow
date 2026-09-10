import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
import type { MembershipTier } from "@/types";
import { TIER_PRESETS } from "../lib/presets";
import type { TierFormOutput } from "../schemas/tier.schema";

/**
 * The shop's own membership packages.
 *
 * Two read paths on purpose. The owner sees every tier including the ones
 * they have switched off; a customer sees only active tiers at an ACTIVE
 * shop, and that is enforced by the `membership_tiers: browse active` policy
 * rather than by this filter — the filter is here so the query uses the
 * `(shop_id, sort_order, created_at)` index.
 */
export async function getTiers(shopId: string): Promise<MembershipTier[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("membership_tiers")
    .select("*")
    .eq("shop_id", shopId)
    .order("sort_order")
    .order("created_at");

  if (error) throw error;
  return data ?? [];
}

/** What a customer may see: active tiers only. RLS says the same thing. */
export async function getPublicTiers(shopId: string): Promise<MembershipTier[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("membership_tiers")
    .select("*")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");

  if (error) throw error;
  return data ?? [];
}

/** `benefits` goes to the DB as the jsonb the CHECK constraint validates. */
function benefitsPayload(values: TierFormOutput) {
  return values.benefits.map((b) => ({
    kind: b.kind,
    label: b.label,
    // Absent rather than null when it means nothing — a PRIORITY_BOOKING
    // benefit has no number, and storing `value: null` invites a UI that
    // prints "null%".
    ...(b.value === undefined ? {} : { value: b.value }),
  }));
}

export async function createTier(
  shopId: string,
  values: TierFormOutput,
): Promise<MembershipTier> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from("membership_tiers")
      .insert({
        shop_id: shopId,
        name: values.name,
        description: values.description || null,
        price: values.price,
        duration_days: values.duration_days,
        benefits: benefitsPayload(values),
        is_active: values.is_active,
        sort_order: values.sort_order,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

/**
 * Edit a tier.
 *
 * `shop_id` is deliberately not sent — `membership_tier_touch()` freezes it
 * anyway, and moving a tier between shops would make its members' snapshots
 * describe a shop they were never enrolled at. Editing price or benefits is
 * safe precisely because every past membership carries its own snapshot.
 */
export async function updateTier(
  tierId: string,
  values: TierFormOutput,
): Promise<MembershipTier> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from("membership_tiers")
      .update({
        name: values.name,
        description: values.description || null,
        price: values.price,
        duration_days: values.duration_days,
        benefits: benefitsPayload(values),
        is_active: values.is_active,
        sort_order: values.sort_order,
      })
      .eq("id", tierId)
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

/**
 * Switch a tier off rather than delete it — the offers pattern, and for a
 * stronger reason here: an inactive tier stops being sold while everyone who
 * already bought it keeps their term.
 */
export async function setTierActive(
  tierId: string,
  isActive: boolean,
): Promise<MembershipTier> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from("membership_tiers")
      .update({ is_active: isActive })
      .eq("id", tierId)
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

/**
 * Delete a tier nobody has bought.
 *
 * The FK is `on delete restrict`, so a tier with members refuses to go and
 * the caller gets "this package has members" rather than a silent cascade
 * through somebody's purchase history.
 */
export async function deleteTier(tierId: string): Promise<void> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { error } = await supabase.from("membership_tiers").delete().eq("id", tierId);
    if (error) throw error;
  });
}

/**
 * Create the four conventional tiers in one go.
 *
 * The migration seeds nothing (decision 36), so this is how Silver/Gold/
 * Platinum/Diamond actually reach a shop: because its owner asked for them.
 * `sort_order` follows the preset order so the ladder reads bottom-up on the
 * customer's page.
 */
export async function seedPresetTiers(shopId: string): Promise<MembershipTier[]> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from("membership_tiers")
      .insert(
        TIER_PRESETS.map((preset, index) => ({
          shop_id: shopId,
          name: preset.name,
          // The Bangla copy is the one an owner will actually edit; a shop's
          // own page is Bangla-first even when the app is in English.
          description: preset.description.bn,
          price: preset.price,
          duration_days: preset.durationDays,
          benefits: preset.benefits.map((b) => ({
            kind: b.kind,
            label: b.label,
            ...(b.value == null ? {} : { value: b.value }),
          })),
          sort_order: index,
        })),
      )
      .select();

    if (error) throw error;
    return data ?? [];
  });
}
