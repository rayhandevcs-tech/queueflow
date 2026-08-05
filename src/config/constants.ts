import type { BusinessType, SerialStatus, ShopStatus, UserRole } from "@/types";

export const ROLES = {
  CUSTOMER: "customer",
  PROVIDER: "provider",
} as const satisfies Record<string, UserRole>;

export const SERIAL_STATUS = {
  WAITING: "WAITING",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
} as const satisfies Record<string, SerialStatus>;

export const ACTIVE_STATUSES: readonly SerialStatus[] = [
  SERIAL_STATUS.WAITING,
  SERIAL_STATUS.IN_PROGRESS,
];

export const LIMITS = {
  MAX_SERVICES_PER_SERIAL: 10, // mirrors serials.service_ids CHECK
  MAX_PHONE_LENGTH: 20,        // mirrors customer_phone CHECK
} as const;

export const ROLE_HOME: Record<UserRole, string> = {
  customer: "/explore",
  provider: "/dashboard",
};

/**
 * Platform admins keep their underlying customer/provider role — admin is a
 * separate membership (admin_users), not a third user_role — so their landing
 * page is resolved before ROLE_HOME, never from it.
 */
export const ADMIN_HOME = "/admin";

export const SHOP_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  REJECTED: "REJECTED",
} as const satisfies Record<string, ShopStatus>;

/** Only these can be picked in the admin filter bar, in this order. */
export const SHOP_STATUSES: readonly ShopStatus[] = [
  SHOP_STATUS.PENDING,
  SHOP_STATUS.ACTIVE,
  SHOP_STATUS.SUSPENDED,
  SHOP_STATUS.REJECTED,
];

/**
 * Product policy: only these two are selectable / bookable.
 * (The DB enum retains a third legacy value; the app never offers it.)
 */
export const SELECTABLE_BUSINESS_TYPES = ["SALON", "PARLOUR"] as const;

export type SelectableBusinessType =
  (typeof SELECTABLE_BUSINESS_TYPES)[number];

export const BUSINESS_TYPES: ReadonlyArray<{
  value: SelectableBusinessType;
  label: { bn: string; en: string };
}> = [
  { value: "SALON", label: { bn: "সেলুন", en: "Salon" } },
  { value: "PARLOUR", label: { bn: "পার্লার", en: "Parlour" } },
];

/** Display fallback covers every DB value, so no row can ever render blank. */
export const BUSINESS_TYPE_LABEL: Record<BusinessType, { bn: string; en: string }> = {
  SALON: { bn: "সেলুন", en: "Salon" },
  PARLOUR: { bn: "পার্লার", en: "Parlour" },
  UNISEX: { bn: "ইউনিসেক্স", en: "Unisex" },
};

export const SERVICE_CATEGORIES = [
  "HAIRCUT",
  "SHAVE",
  "COLOR",
  "FACIAL",
  "SPA",
  "BRIDAL",
  "OTHER",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const SERVICE_CATEGORY_LABEL: Record<ServiceCategory, { bn: string; en: string }> = {
  HAIRCUT: { bn: "চুল কাটা", en: "Haircut" },
  SHAVE: { bn: "শেভ", en: "Shave" },
  COLOR: { bn: "কালার", en: "Color" },
  FACIAL: { bn: "ফেসিয়াল", en: "Facial" },
  SPA: { bn: "স্পা", en: "Spa" },
  BRIDAL: { bn: "ব্রাইডাল", en: "Bridal" },
  OTHER: { bn: "অন্যান্য", en: "Other" },
};

export const ROLE_LABEL: Record<UserRole, { bn: string; en: string }> = {
  customer: { bn: "কাস্টমার", en: "Customer" },
  provider: { bn: "দোকানদার", en: "Provider" },
};

/**
 * Every payment method value the schema/UI know about. Which ones a given
 * shop actually accepts is real per-shop data now (`shops.accepted_payment_methods`,
 * Sprint 18) — "card" is the one value never offered anywhere yet, since
 * confirming it needs POS hardware this app doesn't integrate with.
 */
export const PAYMENT_METHOD_VALUES = ["cash", "bkash", "nagad", "rocket", "card"] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHOD_VALUES)[number];

export const CHAIR_COLORS = [
  "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#64748b",
] as const;