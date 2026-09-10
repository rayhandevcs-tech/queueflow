import type { CustomerMembership, MembershipStatus, MembershipTier } from "@/types";
import { parseTierSnapshot } from "@/types";

/**
 * Everything about a membership that can be decided without asking the
 * database.
 *
 * Pure and in one file for the same reason `compute-due-ledger.ts` is: money
 * and expiry dates are exactly the kind of thing that should be testable
 * without a browser or a Postgres. The database is still the authority —
 * every rule below has a counterpart in `20260921_membership.sql`, and where
 * the two disagree the database wins. This copy exists so the UI can avoid
 * offering a button that would be refused.
 */

/** Mirrors the CHECK on `customer_memberships.status`. */
export const MEMBERSHIP_STATUSES: readonly MembershipStatus[] = [
  "PENDING",
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
];

/**
 * Which status can follow which.
 *
 * **A mirror, not the rule** — the authority is
 * `membership_before_update()`. The two lists have to be changed together.
 *
 * There is no ACTIVE → PENDING and no way back out of EXPIRED or CANCELLED:
 * a membership that lapsed is a fact about a past month, and renewing means a
 * new row (which is also what keeps the historical snapshot honest).
 */
const NEXT: Record<MembershipStatus, readonly MembershipStatus[]> = {
  PENDING: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["EXPIRED", "CANCELLED"],
  EXPIRED: [],
  CANCELLED: [],
};

export function nextStatuses(from: MembershipStatus): readonly MembershipStatus[] {
  return NEXT[from] ?? [];
}

export function canTransition(from: MembershipStatus, to: MembershipStatus): boolean {
  return nextStatuses(from).includes(to);
}

/** Nothing more will happen to it — the UI stops offering actions. */
export function isTerminal(status: MembershipStatus): boolean {
  return nextStatuses(status).length === 0;
}

/**
 * A membership that occupies the customer's one slot at this shop.
 *
 * The same two statuses the partial unique index is built on
 * (`customer_memberships_one_live_idx`), so "can this person join?" is
 * answered the same way on both sides.
 */
export function isLiveStatus(status: MembershipStatus): boolean {
  return status === "PENDING" || status === "ACTIVE";
}

/** The row shape every function here needs — a real row satisfies it. */
export type MembershipLike = Pick<
  CustomerMembership,
  "status" | "expires_at" | "started_at"
>;

/**
 * What the row actually means right now.
 *
 * An ACTIVE row whose `expires_at` has passed reads as EXPIRED here, without
 * waiting for the nightly job. `expire_memberships()` is tidy-up, not
 * correctness — the same stance `membership_is_active()` takes in SQL, and
 * the reason a shop whose cron missed a night still behaves correctly.
 */
export function effectiveStatus(
  membership: MembershipLike,
  now: Date,
): MembershipStatus {
  if (membership.status !== "ACTIVE") return membership.status;
  if (!membership.expires_at) return "ACTIVE";
  return new Date(membership.expires_at).getTime() <= now.getTime() ? "EXPIRED" : "ACTIVE";
}

/** The one question the rest of the app asks. */
export function isActiveNow(membership: MembershipLike, now: Date): boolean {
  return effectiveStatus(membership, now) === "ACTIVE";
}

/**
 * Whole days left, rounded up, floored at 0.
 *
 * Rounded up because a membership with four hours left has not run out yet,
 * and "০ দিন বাকি" next to a card that still works reads as a bug.
 */
export function daysLeft(membership: MembershipLike, now: Date): number | null {
  if (!membership.expires_at) return null;
  const ms = new Date(membership.expires_at).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** True inside the last week — drives the "renew soon" nudge and the summary tile. */
export function isExpiringSoon(membership: MembershipLike, now: Date, withinDays = 7): boolean {
  if (!isActiveNow(membership, now)) return false;
  const left = daysLeft(membership, now);
  return left !== null && left <= withinDays;
}

/**
 * When a membership starting now would run out.
 *
 * The same arithmetic as `make_interval(days => duration_days)` in the
 * trigger, so the owner's "expires 10 October" preview matches what the
 * database will actually store.
 */
export function expiryFrom(startedAt: Date, durationDays: number): Date {
  const end = new Date(startedAt);
  end.setDate(end.getDate() + durationDays);
  return end;
}

/**
 * The membership occupying this customer's slot at this shop, if any.
 *
 * Business-scoped by construction: it filters on `shop_id` and never merges
 * two shops' rows, because a membership at one shop says nothing about
 * another. This is the client-side half of the isolation rule — the
 * enforcing half is RLS.
 */
export function findLiveMembership<T extends MembershipLike & { shop_id: string }>(
  rows: readonly T[],
  shopId: string,
  now: Date,
): T | null {
  return (
    rows.find(
      (row) =>
        row.shop_id === shopId &&
        isLiveStatus(row.status) &&
        effectiveStatus(row, now) !== "EXPIRED",
    ) ?? null
  );
}

/**
 * Would enrolling break the one-live-membership rule?
 *
 * A pre-check for the button's sake only. The database decides — the partial
 * unique index is what actually settles two taps that race, exactly as the
 * appointment exclusion constraint does (decision 43). Never treat a `false`
 * here as permission.
 */
export function hasLiveMembership<T extends MembershipLike & { shop_id: string }>(
  rows: readonly T[],
  shopId: string,
  now: Date,
): boolean {
  return findLiveMembership(rows, shopId, now) !== null;
}

/** Price and name as they were *sold*, not as the tier reads today. */
export function soldAs(membership: Pick<CustomerMembership, "tier_snapshot" | "price" | "duration_days">) {
  const snapshot = parseTierSnapshot(membership.tier_snapshot);
  return {
    // The flat columns win over the snapshot: both are frozen, but the columns
    // are what the database indexes and what any report would sum.
    name: snapshot?.name ?? "",
    description: snapshot?.description ?? null,
    price: membership.price,
    durationDays: membership.duration_days,
    benefits: snapshot?.benefits ?? [],
  };
}

/**
 * Owner-facing ordering: what needs attention first.
 *
 * Requests waiting on the owner come top, then live memberships by how soon
 * they lapse, then everything finished. Sorting by `created_at` instead would
 * bury a pending request under a month of history.
 */
export function sortMembershipsForOwner<T extends MembershipLike & { created_at: string }>(
  rows: readonly T[],
  now: Date,
): T[] {
  const rank = (row: T) => {
    const status = effectiveStatus(row, now);
    if (status === "PENDING") return 0;
    if (status === "ACTIVE") return 1;
    return 2;
  };
  return [...rows].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    const aLeft = daysLeft(a, now);
    const bLeft = daysLeft(b, now);
    if (aLeft !== null && bLeft !== null && aLeft !== bLeft) return aLeft - bLeft;
    return b.created_at.localeCompare(a.created_at);
  });
}

/** Customer-facing ordering on a shop page: cheapest first, owner's order wins. */
export function sortTiers(tiers: readonly MembershipTier[]): MembershipTier[] {
  return [...tiers].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      a.price - b.price ||
      a.created_at.localeCompare(b.created_at),
  );
}
