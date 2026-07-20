export const keys = {
  profile: {
    mine: () => ["profile", "mine"] as const,
  },
  shops: {
    all: ["shops"] as const,
    open: () => ["shops", "open"] as const,
    detail: (shopId: string) => ["shops", shopId] as const,
    mine: () => ["shops", "mine"] as const,
  },
  chairs: {
    byShop: (shopId: string) => ["chairs", shopId] as const,
  },
  services: {
    byShop: (shopId: string) => ["services", shopId] as const,
  },
  chairStats: {
    byShop: (shopId: string) => ["chair-stats", shopId] as const,
  },
  queuePublic: {
    byShop: (shopId: string) => ["queue-public", shopId] as const,
    counts: () => ["queue-public", "counts"] as const,
  },
  serials: {
    mine: () => ["serials", "mine"] as const,
    byShop: (shopId: string) => ["serials", "shop", shopId] as const,
    today: (shopId: string) => ["serials", "today", shopId] as const,
  },
} as const;