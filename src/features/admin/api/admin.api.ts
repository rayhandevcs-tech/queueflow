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
