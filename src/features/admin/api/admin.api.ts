import { getBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import type {
  BusinessType,
  Profile,
  ReportStatus,
  Shop,
  ShopStatus,
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

export async function getShopDetail(shopId: string): Promise<AdminShopDetail | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("admin_shop_detail", { p_shop_id: shopId });
  if (error) throw error;
  return (data as unknown as AdminShopDetail | null) ?? null;
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

export async function deleteUser(
  userId: string,
  reason?: string | null,
): Promise<DeleteUserResult> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("admin_delete_user", {
    p_user_id: userId,
    p_reason: reason?.trim() || null,
  });
  if (error) throw error;
  return data as unknown as DeleteUserResult;
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
