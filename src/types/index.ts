import type { Database, Tables, Json } from "./database.types";

export type Profile = Tables<"profiles">;
export type Shop = Tables<"shops">;
export type Service = Tables<"services">;
export type Chair = Tables<"chairs">;
export type ChairServiceStat = Tables<"chair_service_stats">;
export type Serial = Tables<"serials">;
export type QueuePublicRow = Tables<"queue_public">;
export type Review = Tables<"reviews">;
export type ShopGalleryImage = Tables<"shop_gallery_images">;
export type RegularReminder = Tables<"regular_reminders">;
export type Message = Tables<"messages">;
export type Notification = Tables<"notifications">;
export type Favorite = Tables<"favorites">;
export type PushSubscriptionRow = Tables<"push_subscriptions">;
export type Offer = Tables<"offers">;
export type ManualEntry = Tables<"manual_entries">;
export type ShopRatingSummary = Tables<"shop_rating_summary">;
export type ChairRatingSummary = Tables<"chair_rating_summary">;
export type AdminUser = Tables<"admin_users">;
export type AdminAuditLogRow = Tables<"admin_audit_log">;

export type UserRole = Database["public"]["Enums"]["user_role"];
export type SerialStatus = Database["public"]["Enums"]["serial_status"];
export type AssignmentMode = Database["public"]["Enums"]["assignment_mode"];
export type NotificationType = Database["public"]["Enums"]["notification_type"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type ShopStatus = Database["public"]["Enums"]["shop_status"];
export type AdminLevel = Database["public"]["Enums"]["admin_level"];

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