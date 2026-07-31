import type { BusinessType, SerialStatus, UserRole } from "@/types";

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
 * Single source for which payment methods the app currently supports.
 * Only "cash" is enabled today (bKash/Nagad/Rocket/Card show as "coming
 * soon" on the payment-methods screen) — Sprint 18 moves this to real
 * per-shop settings; until then this is the one place both the settings
 * screen and the queue board's payment sheet read from.
 */
export const PAYMENT_METHOD_VALUES = ["cash", "bkash", "nagad", "rocket", "card"] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHOD_VALUES)[number];
export const ENABLED_PAYMENT_METHODS: readonly PaymentMethodValue[] = ["cash"];

export const CHAIR_COLORS = [
  "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#64748b",
] as const;