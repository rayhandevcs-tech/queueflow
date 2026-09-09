import type {
  AdminLevel,
  AdminStatus,
  BusinessType,
  SerialStatus,
  ShopStatus,
  SupportCategory,
  SupportStatus,
  UserRole,
} from "@/types";

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

/**
 * Since Sprint 36 an admin is its own identity — no profile, no shop, no
 * customer history — so it signs in at its own door rather than at /login.
 */
export const ADMIN_LOGIN = "/admin/login";

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

/**
 * Every category a service can carry.
 *
 * This list is the **source of truth**, and the `services_category_check`
 * constraint in migration `20260917` is its mirror in the database — the two
 * must be changed together, which is why the migration names this file.
 *
 * A code list rather than a `service_categories` table (decision 40): the
 * icon for a category has to live in code either way
 * (`service-category-icon.ts`), so a row added in the database would render
 * without one. A category is therefore not data this system can accept from
 * outside, and pretending otherwise would cost a join on the explore page's
 * cross-shop service query for no gained ability.
 *
 * Order matters — it is the order the picker and the explore shortcut row
 * draw. `OTHER` stays last.
 */
export const SERVICE_CATEGORIES = [
  "HAIRCUT",
  "SHAVE",
  "COLOR",
  "FACIAL",
  "SPA",
  "THREADING",
  "WAXING",
  "MEHENDI",
  "MAKEUP",
  "NAILS",
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
  THREADING: { bn: "থ্রেডিং", en: "Threading" },
  WAXING: { bn: "ওয়্যাক্সিং", en: "Waxing" },
  MEHENDI: { bn: "মেহেদি", en: "Mehendi" },
  MAKEUP: { bn: "মেকআপ", en: "Makeup" },
  NAILS: { bn: "নেইল", en: "Nails" },
  BRIDAL: { bn: "ব্রাইডাল", en: "Bridal" },
  OTHER: { bn: "অন্যান্য", en: "Other" },
};

/**
 * Which trades are offered each category in the picker.
 *
 * Keyed by `business_type` rather than by booking model: what a shop *sells*
 * belongs to the trade, the same reasoning as `business-terms.ts`. UNISEX
 * shops get everything — they are exactly the shops that do both.
 *
 * This narrows the **picker only**. The database check accepts all twelve for
 * every shop, deliberately: a salon that has been tagging bridal work for a
 * year must not have that row rejected on its next edit. `categoriesFor()`
 * keeps a service's existing category in the list for the same reason.
 */
const CATEGORY_TRADES: Record<ServiceCategory, readonly BusinessType[]> = {
  HAIRCUT: ["SALON", "PARLOUR", "UNISEX"],
  SHAVE: ["SALON", "UNISEX"],
  COLOR: ["SALON", "PARLOUR", "UNISEX"],
  FACIAL: ["SALON", "PARLOUR", "UNISEX"],
  SPA: ["SALON", "PARLOUR", "UNISEX"],
  THREADING: ["PARLOUR", "UNISEX"],
  WAXING: ["PARLOUR", "UNISEX"],
  MEHENDI: ["PARLOUR", "UNISEX"],
  MAKEUP: ["PARLOUR", "UNISEX"],
  NAILS: ["PARLOUR", "UNISEX"],
  BRIDAL: ["SALON", "PARLOUR", "UNISEX"],
  OTHER: ["SALON", "PARLOUR", "UNISEX"],
};

/**
 * The categories a shop's picker should offer.
 *
 * `keep` is the value the service already carries: it is always included even
 * when the trade would not offer it, so opening an old service in the editor
 * can never silently drop its category. An unknown business type gets the
 * salon's list — the same direction `bookingModel()` fails in.
 */
export function categoriesFor(
  type: BusinessType | null | undefined,
  keep?: string | null,
): ServiceCategory[] {
  const trade: BusinessType = type === "PARLOUR" || type === "UNISEX" ? type : "SALON";
  const list = SERVICE_CATEGORIES.filter((c) => CATEGORY_TRADES[c].includes(trade));
  if (keep && isServiceCategory(keep) && !list.includes(keep)) {
    return [...list, keep];
  }
  return [...list];
}

/** Narrows a raw `services.category` string, which the DB types as `string`. */
export function isServiceCategory(value: string | null | undefined): value is ServiceCategory {
  return !!value && (SERVICE_CATEGORIES as readonly string[]).includes(value);
}

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

/**
 * Admin roles, coarsest first. The capability each one holds is decided in SQL
 * by admin_can() — this list only drives what the team page can offer, so
 * adding a role means editing one function and one array.
 */
export const ADMIN_LEVELS: readonly AdminLevel[] = ["SUPER_ADMIN", "MODERATOR", "SUPPORT"];

export const ADMIN_LEVEL_LABEL: Record<AdminLevel, { bn: string; en: string }> = {
  SUPER_ADMIN: { bn: "সুপার এডমিন", en: "Super admin" },
  MODERATOR: { bn: "মডারেটর", en: "Moderator" },
  SUPPORT: { bn: "সাপোর্ট", en: "Support" },
};

/** What each role may do, for the "who can do what" note on the team page. */
export const ADMIN_LEVEL_SCOPE: Record<AdminLevel, { bn: string; en: string }> = {
  SUPER_ADMIN: {
    bn: "সবকিছু — এডমিন যোগ ও বাদ দেওয়াসহ",
    en: "Everything, including adding and removing admins",
  },
  MODERATOR: {
    bn: "দোকান যাচাই, ব্যবহারকারী ও রিপোর্ট, সাপোর্ট",
    en: "Shop verification, users and reports, support",
  },
  SUPPORT: { bn: "শুধু সাপোর্ট সেন্টার", en: "Support Center only" },
};

export const ADMIN_STATUS_LABEL: Record<AdminStatus, { bn: string; en: string }> = {
  ACTIVE: { bn: "সক্রিয়", en: "Active" },
  DISABLED: { bn: "বন্ধ", en: "Disabled" },
};

export const SUPPORT_CATEGORIES: readonly SupportCategory[] = [
  "BOOKING",
  "PAYMENT",
  "ACCOUNT",
  "SHOP",
  "TECHNICAL",
  "OTHER",
];

export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, { bn: string; en: string }> = {
  BOOKING: { bn: "সিরিয়াল ও বুকিং", en: "Serial and booking" },
  PAYMENT: { bn: "পেমেন্ট ও বকেয়া", en: "Payment and dues" },
  ACCOUNT: { bn: "অ্যাকাউন্ট ও লগইন", en: "Account and login" },
  SHOP: { bn: "দোকান সংক্রান্ত", en: "About a shop" },
  TECHNICAL: { bn: "অ্যাপে সমস্যা", en: "App problem" },
  OTHER: { bn: "অন্যান্য", en: "Something else" },
};

/** Lifecycle order, which is also the order of the admin filter tabs. */
export const SUPPORT_STATUSES: readonly SupportStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "SOLVED",
  "CLOSED",
];

export const SUPPORT_STATUS_LABEL: Record<SupportStatus, { bn: string; en: string }> = {
  PENDING: { bn: "অপেক্ষমাণ", en: "Pending" },
  IN_PROGRESS: { bn: "চলছে", en: "In progress" },
  SOLVED: { bn: "সমাধান হয়েছে", en: "Solved" },
  CLOSED: { bn: "বন্ধ", en: "Closed" },
};

export const CHAIR_COLORS = [
  "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#64748b",
] as const;