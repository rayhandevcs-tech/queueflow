export const keys = {
  profile: {
    mine: () => ["profile", "mine"] as const,
  },
  shops: {
    all: ["shops"] as const,
    open: () => ["shops", "open"] as const,
    detail: (shopId: string) => ["shops", shopId] as const,
    mine: () => ["shops", "mine"] as const,
    acceptedPaymentMethods: (shopId: string) => ["shops", shopId, "accepted-payment-methods"] as const,
  },
  chairs: {
    byShop: (shopId: string) => ["chairs", shopId] as const,
    publicByShop: (shopId: string) => ["chairs", "public", shopId] as const,
  },
  services: {
    byShop: (shopId: string) => ["services", shopId] as const,
    allActive: () => ["services", "all-active"] as const,
  },
  chairStats: {
    byShop: (shopId: string) => ["chair-stats", shopId] as const,
    capabilities: (serviceIds: string[]) =>
      ["chair-stats", "capabilities", serviceIds.slice().sort()] as const,
  },
  shopGallery: {
    byShop: (shopId: string) => ["shop-gallery", shopId] as const,
  },
  queuePublic: {
    byShop: (shopId: string) => ["queue-public", shopId] as const,
    counts: () => ["queue-public", "counts"] as const,
  },
  serials: {
    mine: () => ["serials", "mine"] as const,
    myHistory: () => ["serials", "my-history"] as const,
    byShop: (shopId: string) => ["serials", "shop", shopId] as const,
    today: (shopId: string) => ["serials", "today", shopId] as const,
    liveCount: (shopId: string) => ["serials", "live-count", shopId] as const,
    incomeHistory: (shopId: string) => ["serials", "income-history", shopId] as const,
    analyticsHistory: (shopId: string) => ["serials", "analytics-history", shopId] as const,
  },
  dueLedger: {
    byShop: (shopId: string) => ["due-ledger", "shop", shopId] as const,
    countByShop: (shopId: string) => ["due-ledger", "count", "shop", shopId] as const,
    manualByShop: (shopId: string) => ["due-ledger", "manual", "shop", shopId] as const,
    manualCountByShop: (shopId: string) => ["due-ledger", "manual-count", "shop", shopId] as const,
  },
  reviews: {
    mine: () => ["reviews", "mine"] as const,
    byShop: (shopId: string) => ["reviews", "shop", shopId] as const,
    publicByShop: (shopId: string) => ["reviews", "public", shopId] as const,
  },
  reminders: {
    thisMonth: (shopId: string) => ["reminders", "this-month", shopId] as const,
  },
  notifications: {
    mine: (userId: string) => ["notifications", "mine", userId] as const,
  },
  favorites: {
    mine: () => ["favorites", "mine"] as const,
  },
  pushSubscription: {
    mine: () => ["push-subscription", "mine"] as const,
  },
  offers: {
    byShop: (shopId: string) => ["offers", shopId] as const,
    activeCarousel: () => ["offers", "active-carousel"] as const,
  },
  manualEntries: {
    byShop: (shopId: string) => ["manual-entries", shopId] as const,
  },
  ratingSummary: {
    all: () => ["rating-summary", "all"] as const,
  },
  chairRatingSummary: {
    all: () => ["chair-rating-summary", "all"] as const,
  },
  messages: {
    thread: (shopId: string, customerId: string) => ["messages", shopId, customerId] as const,
    hasHistoryAtShop: (shopId: string) => ["messages", "has-history", shopId] as const,
    customerName: (shopId: string, customerId: string) =>
      ["messages", "customer-name", shopId, customerId] as const,
  },
  chatThreads: {
    mine: () => ["chat-threads", "mine"] as const,
    byShop: (shopId: string) => ["chat-threads", "shop", shopId] as const,
    unreadCountMine: () => ["chat-threads", "unread-count", "mine"] as const,
    unreadCountByShop: (shopId: string) => ["chat-threads", "unread-count", "shop", shopId] as const,
  },
} as const;