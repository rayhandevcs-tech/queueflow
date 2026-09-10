import type { Database, Tables, Json } from "./database.types";

export type Profile = Tables<"profiles">;
export type Shop = Tables<"shops">;
export type Service = Tables<"services">;
export type Chair = Tables<"chairs">;
export type ChairServiceStat = Tables<"chair_service_stats">;
export type Hairstyle = Tables<"hairstyles">;
export type SerialStylePreference = Tables<"serial_style_preferences">;
export type Serial = Tables<"serials">;
export type Appointment = Tables<"appointments">;
export type StaffWorkingHours = Tables<"staff_working_hours">;
export type StaffTimeOff = Tables<"staff_time_off">;
export type AppointmentReschedule = Tables<"appointment_reschedules">;
export type QueuePublicRow = Tables<"queue_public">;
export type Review = Tables<"reviews">;
export type ShopGalleryImage = Tables<"shop_gallery_images">;
export type RegularReminder = Tables<"regular_reminders">;
export type Message = Tables<"messages">;
export type Notification = Tables<"notifications">;
export type Favorite = Tables<"favorites">;
export type CustomerReminder = Tables<"customer_reminders">;
export type PushSubscriptionRow = Tables<"push_subscriptions">;
export type Offer = Tables<"offers">;
export type MembershipTier = Tables<"membership_tiers">;
export type CustomerMembership = Tables<"customer_memberships">;
export type MembershipStatus = Database["public"]["Enums"]["membership_status"];
export type ManualEntry = Tables<"manual_entries">;
export type ShopExpense = Tables<"shop_expenses">;
export type ExpenseCategory = Database["public"]["Enums"]["expense_category"];
export type ShopRatingSummary = Tables<"shop_rating_summary">;
export type ChairRatingSummary = Tables<"chair_rating_summary">;
export type AdminUser = Tables<"admin_users">;
export type AdminAuditLogRow = Tables<"admin_audit_log">;
export type Report = Tables<"reports">;

export type UserRole = Database["public"]["Enums"]["user_role"];
export type SerialStatus = Database["public"]["Enums"]["serial_status"];
export type AppointmentStatusDb = Database["public"]["Enums"]["appointment_status"];
export type AssignmentMode = Database["public"]["Enums"]["assignment_mode"];
export type NotificationType = Database["public"]["Enums"]["notification_type"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type ShopStatus = Database["public"]["Enums"]["shop_status"];
export type AdminLevel = Database["public"]["Enums"]["admin_level"];
export type AdminStatus = Database["public"]["Enums"]["admin_status"];
export type SupportCategory = Database["public"]["Enums"]["support_category"];
export type SupportStatus = Database["public"]["Enums"]["support_status"];
export type ReportTargetType = Database["public"]["Enums"]["report_target_type"];
export type ReportReason = Database["public"]["Enums"]["report_reason"];
export type ReportStatus = Database["public"]["Enums"]["report_status"];

export type BusinessType = Database["public"]["Enums"]["business_type"];
export type { TablesInsert, TablesUpdate, Json } from "./database.types";

/** profiles.notification_prefs: missing key / non-false value = enabled (opt-out model). */
export type NotificationPrefs = Partial<Record<NotificationType, boolean>>;

/** Shape of one element inside serials.services_snapshot (frozen at booking). */
export type ServiceSnapshotItem = {
  service_id: string;
  name: string;
  rate: number;
  estimated_duration_min: number;
};

/** Safe accessor for the jsonb snapshot column. */
export function parseServicesSnapshot(snapshot: Json): ServiceSnapshotItem[] {
  return Array.isArray(snapshot)
    ? (snapshot as unknown as ServiceSnapshotItem[])
    : [];
}

/**
 * What a membership tier promises.
 *
 * Definition only — Sprint 6 builds no redemption engine, deliberately. A
 * benefit here is something an owner has written down and will honour at the
 * counter; teaching the app to *apply* it is Sprint 7+ work, and doing half of
 * it now would leave a discount that sometimes came off the bill and
 * sometimes didn't.
 *
 * The five kinds are fixed in SQL too (`membership_benefits_valid`), so a new
 * one means editing both — which is the point: a kind nothing can honour is
 * worse than no kind at all.
 */
export const MEMBERSHIP_BENEFIT_KINDS = [
  "DISCOUNT",
  "FREE_SERVICE",
  "PRIORITY_BOOKING",
  "COMPLIMENTARY",
  "SPECIAL_OFFER",
] as const;

export type MembershipBenefitKind = (typeof MEMBERSHIP_BENEFIT_KINDS)[number];

export type MembershipBenefit = {
  kind: MembershipBenefitKind;
  /** The owner's own words — this is what the customer reads. */
  label: string;
  /** Percent for DISCOUNT, a count for the others, absent where meaningless. */
  value?: number | null;
};

/** Shape of `customer_memberships.tier_snapshot`, frozen at enrollment. */
export type MembershipTierSnapshot = {
  tier_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_days: number;
  benefits: MembershipBenefit[];
};

/**
 * Safe accessor for a benefits jsonb column.
 *
 * Filters rather than casts: the SQL CHECK guards what this app writes, but a
 * row could predate a kind being renamed, and a card that renders "undefined"
 * is worse than one that renders one benefit fewer.
 */
export function parseBenefits(benefits: Json): MembershipBenefit[] {
  if (!Array.isArray(benefits)) return [];
  const kinds: readonly string[] = MEMBERSHIP_BENEFIT_KINDS;
  return benefits.flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const row = raw as Record<string, Json>;
    const kind = typeof row.kind === "string" ? row.kind : "";
    const label = typeof row.label === "string" ? row.label.trim() : "";
    if (!kinds.includes(kind) || !label) return [];
    return [
      {
        kind: kind as MembershipBenefitKind,
        label,
        value: typeof row.value === "number" ? row.value : null,
      },
    ];
  });
}

/** Safe accessor for `customer_memberships.tier_snapshot`. */
export function parseTierSnapshot(snapshot: Json): MembershipTierSnapshot | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const row = snapshot as Record<string, Json>;
  if (typeof row.name !== "string") return null;
  return {
    tier_id: typeof row.tier_id === "string" ? row.tier_id : "",
    name: row.name,
    description: typeof row.description === "string" ? row.description : null,
    price: typeof row.price === "number" ? row.price : Number(row.price ?? 0) || 0,
    duration_days: typeof row.duration_days === "number" ? row.duration_days : 0,
    benefits: parseBenefits(row.benefits ?? []),
  };
}