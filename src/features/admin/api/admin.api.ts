import { getBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import type {
  AdminLevel,
  AdminStatus,
  BusinessType,
  Profile,
  ReportStatus,
  Shop,
  ShopStatus,
  SupportStatus,
  UserRole,
} from "@/types";

/** Row shape of the admin_list_shops() RPC (aggregates joined server-side). */
export type AdminShopRow =
  Database["public"]["Functions"]["admin_list_shops"]["Returns"][number];

export type AdminUserRow =
  Database["public"]["Functions"]["admin_list_users"]["Returns"][number];

export type AdminReportRow =
  Database["public"]["Functions"]["admin_list_reports"]["Returns"][number];

export interface AdminOverviewStats {
  shops_total: number;
  shops_pending: number;
  shops_active: number;
  shops_suspended: number;
  shops_rejected: number;
  shops_salon: number;
  shops_parlour: number;
  shops_open_now: number;
  customers_total: number;
  providers_total: number;
  signups_7d: number;
  serials_today: number;
  serials_live: number;
  serials_30d: number;
  gmv_30d: number;
  reviews_total: number;
  open_reports: number;
  blocked_users: number;
  hidden_reviews: number;
  dormant_shops: number;
  daily: Array<{ day: string; serials: number; signups: number }>;
}

export interface AdminUserDetail {
  profile: Profile;
  email: string | null;
  email_confirmed: boolean;
  last_sign_in_at: string | null;
  shop: { id: string; name: string; status: ShopStatus } | null;
  stats: {
    serials_total: number;
    serials_done: number;
    cancelled: number;
    no_shows: number;
    spend_total: number;
    due_total: number;
    reviews_count: number;
    favourites: number;
    last_serial_at: string | null;
  };
  /** WAITING/IN_PROGRESS — what blocks the customer from booking again. */
  active_serials: Array<{
    id: string;
    status: string;
    position: number;
    created_at: string;
    shop_name: string | null;
  }>;
  recent_serials: Array<{
    id: string;
    status: string;
    total_amount: number;
    payment_status: string;
    created_at: string;
    shop_name: string | null;
  }>;
  reports_against: Array<{
    id: string;
    target_type: string;
    reason: string;
    note: string | null;
    status: ReportStatus;
    created_at: string;
  }>;
  audit: Array<{
    id: string;
    action: string;
    meta: { reason?: string | null };
    created_at: string;
    actor_name: string | null;
  }>;
}

export interface AdminShopDetail {
  shop: Shop;
  owner: {
    id: string;
    full_name: string;
    phone: string | null;
    avatar_url: string | null;
    created_at: string;
  } | null;
  owner_email: string | null;
  stats: {
    chairs: number;
    services: number;
    gallery: number;
    offers_active: number;
    serials_total: number;
    serials_30d: number;
    serials_live: number;
    no_shows_30d: number;
    revenue_30d: number;
    due_total: number;
    avg_rating: number;
    review_count: number;
    last_serial_at: string | null;
  };
  readiness: {
    has_location: boolean;
    has_phone: boolean;
    has_cover: boolean;
    has_about: boolean;
    has_hours: boolean;
    has_chair: boolean;
    has_service: boolean;
  };
  recent_reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    customer_name: string | null;
  }>;
  audit: Array<{
    id: string;
    action: string;
    meta: { from?: string; to?: string; reason?: string | null; featured?: boolean };
    created_at: string;
    actor_name: string | null;
  }>;
}

export interface AdminShopFilters {
  status?: ShopStatus | null;
  businessType?: BusinessType | null;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * The real membership check, straight from admin_users via RLS. The middleware
 * only reads the JWT claim — this is what the panel itself trusts, so a stale
 * or hand-edited claim still lands on the "not an admin" screen.
 */
export async function amIPlatformAdmin(): Promise<boolean> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("is_platform_admin");
  if (error) throw error;
  return data === true;
}

export async function getOverviewStats(): Promise<AdminOverviewStats> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("admin_overview_stats");
  if (error) throw error;
  return data as unknown as AdminOverviewStats;
}

export async function listShops(
  filters: AdminShopFilters,
): Promise<{ rows: AdminShopRow[]; total: number }> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("admin_list_shops", {
    p_status: filters.status ?? null,
    p_business_type: filters.businessType ?? null,
    p_search: filters.search?.trim() || null,
    p_limit: filters.limit ?? 50,
    p_offset: filters.offset ?? 0,
  });
  if (error) throw error;

  const rows = data ?? [];
  // total_count rides along on every row (window function) — an empty page
  // just means there is nothing left to count.
  return { rows, total: rows[0]?.total_count ?? 0 };
}

/**
 * Numeric stats arrive from the RPC as JSON, and one of them can be null even
 * though the type says number: admin_shop_detail builds the rating as
 * `(select coalesce(avg_rating, 0) from shop_rating_summary where …)`. The
 * coalesce is inside the sub-query, so it only rescues a NULL column in a row
 * that exists — a shop with no reviews at all has no row there, the whole
 * sub-query is NULL, and the coalesce never runs. review_count came back null
 * too, so the `review_count === 0` guard in the UI failed and
 * `avg_rating.toFixed(1)` took the whole admin page down.
 *
 * Normalised here rather than at each call site: a panel should not white-
 * screen because a number was absent, and there is more than one number.
 */
function normaliseShopStats(detail: AdminShopDetail): AdminShopDetail {
  const s = detail.stats;
  const n = (value: number | null | undefined) => Number(value ?? 0);

  return {
    ...detail,
    stats: {
      ...s,
      chairs: n(s.chairs),
      services: n(s.services),
      gallery: n(s.gallery),
      offers_active: n(s.offers_active),
      serials_total: n(s.serials_total),
      serials_30d: n(s.serials_30d),
      serials_live: n(s.serials_live),
      no_shows_30d: n(s.no_shows_30d),
      revenue_30d: n(s.revenue_30d),
      due_total: n(s.due_total),
      avg_rating: n(s.avg_rating),
      review_count: n(s.review_count),
    },
  };
}

export async function getShopDetail(shopId: string): Promise<AdminShopDetail | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("admin_shop_detail", { p_shop_id: shopId });
  if (error) throw error;

  const detail = (data as unknown as AdminShopDetail | null) ?? null;
  return detail ? normaliseShopStats(detail) : null;
}

export async function setShopStatus(
  shopId: string,
  status: ShopStatus,
  reason?: string | null,
): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.rpc("admin_set_shop_status", {
    p_shop_id: shopId,
    p_status: status,
    p_reason: reason?.trim() || null,
  });
  if (error) throw error;
}

export async function setShopFeatured(shopId: string, featured: boolean): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.rpc("admin_set_shop_featured", {
    p_shop_id: shopId,
    p_featured: featured,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface AdminUserFilters {
  role?: UserRole | null;
  blocked?: boolean | null;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listUsers(
  filters: AdminUserFilters,
): Promise<{ rows: AdminUserRow[]; total: number }> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_role: filters.role ?? null,
    p_blocked: filters.blocked ?? null,
    p_search: filters.search?.trim() || null,
    p_limit: filters.limit ?? 50,
    p_offset: filters.offset ?? 0,
  });
  if (error) throw error;

  const rows = data ?? [];
  return { rows, total: rows[0]?.total_count ?? 0 };
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("admin_user_detail", { p_user_id: userId });
  if (error) throw error;
  return (data as unknown as AdminUserDetail | null) ?? null;
}

export async function setUserBlocked(
  userId: string,
  blocked: boolean,
  reason?: string | null,
): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.rpc("admin_set_user_blocked", {
    p_user_id: userId,
    p_blocked: blocked,
    p_reason: reason?.trim() || null,
  });
  if (error) throw error;
}

export interface AdminProfilePatch {
  full_name?: string;
  phone?: string;
  gender?: string;
  date_of_birth?: string | null;
  address?: string;
}

/** Field-level repair of a user's own data. Undefined = leave that field alone. */
export async function updateUserProfile(
  userId: string,
  patch: AdminProfilePatch,
): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.rpc("admin_update_user_profile", {
    p_user_id: userId,
    p_full_name: patch.full_name ?? null,
    p_phone: patch.phone ?? null,
    p_gender: patch.gender ?? null,
    p_date_of_birth: patch.date_of_birth ?? null,
    p_address: patch.address ?? null,
  });
  if (error) throw error;
}

/** Clears a stuck WAITING/IN_PROGRESS serial that blocks re-booking. */
export async function forceCancelSerial(
  serialId: string,
  reason?: string | null,
): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.rpc("admin_force_cancel_serial", {
    p_serial_id: serialId,
    p_reason: reason?.trim() || null,
  });
  if (error) throw error;
}

export interface DeleteUserResult {
  email: string | null;
  shop_deleted: boolean;
  shop_serials_deleted: number;
  serials_anonymised: number;
}

/**
 * Routed through /api/admin/account rather than calling admin_delete_user()
 * directly. The RPC tears down the public schema, but the auth.users row — and
 * the identity row that actually holds the email address — can only be removed
 * through Supabase's Admin API. Deleting it in SQL freed the user row and
 * stranded the identity, which is why a deleted account's email could never be
 * registered again.
 */
export async function deleteUser(
  userId: string,
  reason?: string | null,
): Promise<DeleteUserResult> {
  const response = await fetch("/api/admin/account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete_account", userId, reason: reason?.trim() || null }),
  });

  const payload = (await response.json().catch(() => null)) as
    | (Partial<DeleteUserResult> & { error?: string })
    | null;

  if (!response.ok) throw new Error(payload?.error ?? "মোছা যায়নি");

  return {
    email: payload?.email ?? null,
    shop_deleted: payload?.shop_deleted ?? false,
    shop_serials_deleted: payload?.shop_serials_deleted ?? 0,
    serials_anonymised: payload?.serials_anonymised ?? 0,
  };
}

export type AdminAccountAction = "confirm_email" | "change_email" | "send_password_reset";

/**
 * Auth-schema repairs — routed through /api/admin/account, which re-checks
 * admin membership server-side and uses Supabase's Admin API (see the route
 * for why these can't be SQL functions).
 */
export async function runAccountAction(input: {
  action: AdminAccountAction;
  userId: string;
  email?: string;
}): Promise<void> {
  const response = await fetch("/api/admin/account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "failed");
  }
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

export async function listReports(
  status: ReportStatus | null,
  limit = 50,
): Promise<{ rows: AdminReportRow[]; total: number }> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("admin_list_reports", {
    p_status: status,
    p_limit: limit,
    p_offset: 0,
  });
  if (error) throw error;

  const rows = data ?? [];
  return { rows, total: rows[0]?.total_count ?? 0 };
}

export async function resolveReport(
  reportId: string,
  status: ReportStatus,
  note?: string | null,
): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.rpc("admin_resolve_report", {
    p_report_id: reportId,
    p_status: status,
    p_note: note?.trim() || null,
  });
  if (error) throw error;
}

export async function setReviewHidden(
  reviewId: string,
  hidden: boolean,
  reason?: string | null,
): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.rpc("admin_set_review_hidden", {
    p_review_id: reviewId,
    p_hidden: hidden,
    p_reason: reason?.trim() || null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// The admin's own identity
// ---------------------------------------------------------------------------

export type AdminIdentity =
  Database["public"]["Functions"]["my_admin_identity"]["Returns"][number];

export type AdminTeamRow =
  Database["public"]["Functions"]["admin_list_admins"]["Returns"][number];

/**
 * Who the signed-in admin is, read from admin_users rather than profiles.
 * An admin provisioned from the panel has no profiles row at all — that
 * absence is what makes it "not a customer" — so the panel shell cannot use
 * useMyProfile() the way the customer and provider shells do.
 *
 * Returns null for anyone who is not an active admin, which is also how
 * /admin/login tells "wrong password" apart from "not an admin".
 */
export async function getMyAdminIdentity(): Promise<AdminIdentity | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("my_admin_identity");
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function listAdmins(): Promise<AdminTeamRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("admin_list_admins");
  if (error) throw error;
  return data ?? [];
}

export async function setAdminStatus(userId: string, status: AdminStatus): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.rpc("admin_set_admin_status", {
    p_user_id: userId,
    p_status: status,
  });
  if (error) throw error;
}

export async function setAdminLevel(userId: string, level: AdminLevel): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.rpc("admin_set_admin_level", {
    p_user_id: userId,
    p_level: level,
  });
  if (error) throw error;
}

export async function revokeAdmin(userId: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.rpc("admin_revoke_admin", { p_user_id: userId });
  if (error) throw error;
}

/**
 * Creating the login itself needs Supabase's Admin API, which needs the
 * service-role key — so this one write goes through a server route instead of
 * an RPC. The route re-checks that the caller is a SUPER_ADMIN before it
 * touches anything.
 */
export async function createAdmin(input: {
  fullName: string;
  email: string;
  password: string;
  level: AdminLevel;
}): Promise<void> {
  const res = await fetch("/api/admin/admins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "failed");
  }
}

/**
 * Sets another admin's password outright, rather than mailing them a reset
 * link — panel access must not depend on inbox delivery, and a locked-out
 * admin is exactly whose mail you cannot count on. Same route, same
 * SUPER_ADMIN check; the server refuses any target that is not already an
 * admin.
 */
export async function setAdminPassword(input: {
  userId: string;
  password: string;
}): Promise<void> {
  const res = await fetch("/api/admin/admins", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "failed");
  }
}

// ---------------------------------------------------------------------------
// Support Center
// ---------------------------------------------------------------------------

export type AdminTicketRow =
  Database["public"]["Functions"]["admin_list_tickets"]["Returns"][number];

export type AdminTicketCounts =
  Database["public"]["Functions"]["admin_ticket_counts"]["Returns"][number];

export async function listTickets(
  status: SupportStatus | null,
  search: string,
): Promise<{ rows: AdminTicketRow[]; total: number }> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("admin_list_tickets", {
    p_status: status,
    p_search: search.trim() || null,
    p_limit: 100,
    p_offset: 0,
  });
  if (error) throw error;

  const rows = data ?? [];
  return { rows, total: rows[0]?.total_count ?? 0 };
}

export async function getTicketCounts(): Promise<AdminTicketCounts> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("admin_ticket_counts");
  if (error) throw error;
  return data?.[0] ?? { pending: 0, in_progress: 0, solved: 0, closed: 0 };
}

export async function replyToTicket(input: {
  ticketId: string;
  body: string;
  images?: string[];
  internal?: boolean;
}): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.rpc("admin_reply_ticket", {
    p_ticket_id: input.ticketId,
    p_body: input.body.trim(),
    p_images: input.images ?? [],
    p_internal: input.internal ?? false,
  });
  if (error) throw error;
}

export async function setTicketStatus(
  ticketId: string,
  status: SupportStatus,
): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.rpc("admin_set_ticket_status", {
    p_ticket_id: ticketId,
    p_status: status,
  });
  if (error) throw error;
}

export async function markTicketReadByAdmin(ticketId: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.rpc("admin_mark_ticket_read", { p_ticket_id: ticketId });
  if (error) throw error;
}

export type AdminTicketMessage =
  Database["public"]["Tables"]["support_ticket_messages"]["Row"];

/**
 * Every message on a ticket, including internal notes.
 *
 * Read straight from the table rather than through an RPC: the "admin read"
 * RLS policy already admits exactly this set, and the customer-side policy
 * excludes internal notes, so the same query returns a different — correct —
 * set of rows depending on who runs it.
 */
export async function listTicketMessages(ticketId: string): Promise<AdminTicketMessage[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Recent shops — the watchlist that replaced the approval queue
// ---------------------------------------------------------------------------
// Shops go live the moment they register (see 20260913), so nothing waits for
// an admin any more. What an admin still needs is to see who just arrived, and
// which of them look like nobody is actually running a shop there.

export interface AdminRecentShop {
  id: string;
  name: string;
  status: ShopStatus;
  address: string | null;
  business_type: BusinessType;
  logo_url: string | null;
  created_at: string;
  owner_name: string | null;
  owner_email: string | null;
  chairs: number;
  services: number;
  serials: number;
  /** No staff, no service, or no map pin — it cannot serve anyone yet. */
  incomplete: boolean;
}

export async function listRecentShops(days = 30): Promise<AdminRecentShop[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("admin_recent_shops", { p_days: days });
  if (error) throw error;

  const rows = (data as unknown as AdminRecentShop[] | null) ?? [];
  // Counts arrive as bigint, which PostgREST serialises as a string.
  return rows.map((r) => ({
    ...r,
    chairs: Number(r.chairs ?? 0),
    services: Number(r.services ?? 0),
    serials: Number(r.serials ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Audit feed — who did what
// ---------------------------------------------------------------------------

export interface AdminAuditRow {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  actor_name: string | null;
  /** Resolved shop or user name, so a row reads without another lookup. */
  target_name: string | null;
}

export async function listAuditFeed(action?: string | null): Promise<AdminAuditRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("admin_audit_feed", {
    p_action: action ?? null,
  });
  if (error) throw error;
  return (data as unknown as AdminAuditRow[] | null) ?? [];
}
