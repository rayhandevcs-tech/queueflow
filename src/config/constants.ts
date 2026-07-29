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
  label: string;
}> = [
  { value: "SALON", label: "সেলুন" },
  { value: "PARLOUR", label: "পার্লার" },
];

/** Display fallback covers every DB value, so no row can ever render blank. */
export const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  SALON: "সেলুন",
  PARLOUR: "পার্লার",
  UNISEX: "ইউনিসেক্স",
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

export const SERVICE_CATEGORY_LABEL: Record<ServiceCategory, string> = {
  HAIRCUT: "চুল কাটা",
  SHAVE: "শেভ",
  COLOR: "কালার",
  FACIAL: "ফেসিয়াল",
  SPA: "স্পা",
  BRIDAL: "ব্রাইডাল",
  OTHER: "অন্যান্য",
};

export const CHAIR_COLORS = [
  "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#64748b",
] as const;