import type { ShopStatus } from "@/types";
import type { adminDict } from "./i18n";

/** One place that maps a lifecycle status to its dict key + pill tone. */
export const SHOP_STATUS_LABEL_KEY = {
  PENDING: "statusPENDING",
  ACTIVE: "statusACTIVE",
  SUSPENDED: "statusSUSPENDED",
  REJECTED: "statusREJECTED",
} as const satisfies Record<ShopStatus, keyof typeof adminDict>;

export const SHOP_STATUS_TONE = {
  PENDING: "brass",
  ACTIVE: "good",
  SUSPENDED: "live",
  REJECTED: "neutral",
} as const satisfies Record<ShopStatus, "brass" | "good" | "live" | "neutral">;
