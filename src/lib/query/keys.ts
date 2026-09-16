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
  display: {
    board: (shopId: string) => ["display", shopId] as const,
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
    party: (groupId: string) => ["serials", "party", groupId] as const,
  },
  appointments: {
    /** `day` is local "YYYY-MM-DD" — see `ymd()` in `src/lib/day-key.ts`. */
    byShopDay: (shopId: string, day: string) => ["appointments", shopId, day] as const,
    mine: () => ["appointments", "mine"] as const,
    slots: (shopId: string, day: string, serviceIds: string[], staffId: string | null) =>
      ["appointments", "slots", shopId, day, serviceIds.slice().sort(), staffId] as const,
    incomeHistory: (shopId: string) => ["appointments", "income-history", shopId] as const,
    list: (shopId: string, filters: { scope: string; staffId: string | null; from: string | null; to: string | null }) =>
      ["appointments", "list", shopId, filters] as const,
  },
  staffAvailability: {
    hours: (chairIds: string[]) =>
      ["staff-availability", "hours", chairIds.slice().sort()] as const,
    timeOff: (chairIds: string[]) =>
      ["staff-availability", "time-off", chairIds.slice().sort()] as const,
  },
  dueLedger: {
    byShop: (shopId: string) => ["due-ledger", "shop", shopId] as const,
    countByShop: (shopId: string) => ["due-ledger", "count", "shop", shopId] as const,
    manualByShop: (shopId: string) => ["due-ledger", "manual", "shop", shopId] as const,
    manualCountByShop: (shopId: string) => ["due-ledger", "manual-count", "shop", shopId] as const,
    appointmentsByShop: (shopId: string) => ["due-ledger", "appointments", "shop", shopId] as const,
  },
  membership: {
    /** Every tier, switched-off ones included — the owner's list. */
    tiers: (shopId: string) => ["membership", "tiers", shopId] as const,
    /** Active tiers only — what a customer sees on a shop page. */
    publicTiers: (shopId: string) => ["membership", "public-tiers", shopId] as const,
    byShop: (shopId: string) => ["membership", "shop", shopId] as const,
    mine: () => ["membership", "mine"] as const,
    summary: (shopId: string) => ["membership", "summary", shopId] as const,
    shopCustomers: (shopId: string) => ["membership", "shop-customers", shopId] as const,
    shops: (shopIds: string[]) => ["membership", "shops", shopIds.slice().sort()] as const,
  },
  loyalty: {
    settings: (shopId: string) => ["loyalty", "settings", shopId] as const,
    accounts: (shopId: string) => ["loyalty", "accounts", shopId] as const,
    customerNames: (shopId: string) => ["loyalty", "customer-names", shopId] as const,
    ledger: (shopId: string, customerId: string) =>
      ["loyalty", "ledger", shopId, customerId] as const,
    myCards: () => ["loyalty", "my-cards"] as const,
  },
  referral: {
    /**
     * Every key carries `shopId`, because a referral code, a referral list
     * and a referral reward are all shop-scoped — a cache shared across shops
     * would show one shop's code on another shop's page.
     */
    myCode: (shopId: string) => ["referral", "my-code", shopId] as const,
    mine: (shopId: string) => ["referral", "mine", shopId] as const,
    claimed: (shopId: string) => ["referral", "claimed", shopId] as const,
    stats: (shopId: string) => ["referral", "stats", shopId] as const,
    /** Not shop-scoped on purpose: this one IS the list across shops. */
    myShops: () => ["referral", "my-shops"] as const,
  },
  rewards: {
    /**
     * Every key carries `shopId` — a reward, a coupon and a points balance are
     * all shop-scoped, so a cache entry shared across shops could offer one
     * shop's reward against another shop's points.
     */
    catalogue: (shopId: string) => ["rewards", "catalogue", shopId] as const,
    publicCatalogue: (shopId: string) => ["rewards", "public", shopId] as const,
    redemptions: (shopId: string) => ["rewards", "redemptions", shopId] as const,
    myBalance: (shopId: string) => ["rewards", "my-balance", shopId] as const,
    openBookings: (shopId: string, customerId: string) =>
      ["rewards", "open-bookings", shopId, customerId] as const,
    /** Not shop-scoped on purpose: this one IS the list across shops. */
    myCoupons: () => ["rewards", "my-coupons"] as const,
  },
  analytics: {
    /**
     * Sprint 10's dashboard. Every key is
     * `["analytics", <metric>, shopId, "from..to"]` — shop **and** range, both
     * mandatory, because either one missing is a cache leak with a different
     * shape: without the shop id one owner's cache would answer for another
     * shop, and without the range last week's numbers would be served under
     * this week's heading. The range arrives pre-joined by `rangeKey()` so the
     * key stays a flat tuple of strings rather than an object identity that
     * changes on every render.
     */
    overview: (shopId: string, range: string) => ["analytics", "overview", shopId, range] as const,
    trend: (shopId: string, range: string, bucket: string) =>
      ["analytics", "trend", shopId, range, bucket] as const,
    appointments: (shopId: string, range: string) =>
      ["analytics", "appointments", shopId, range] as const,
    queue: (shopId: string, range: string) => ["analytics", "queue", shopId, range] as const,
    staff: (shopId: string, range: string) => ["analytics", "staff", shopId, range] as const,
    peak: (shopId: string, range: string) => ["analytics", "peak", shopId, range] as const,
    loyalty: (shopId: string, range: string) => ["analytics", "loyalty", shopId, range] as const,
    membership: (shopId: string, range: string) =>
      ["analytics", "membership", shopId, range] as const,
    referral: (shopId: string, range: string) => ["analytics", "referral", shopId, range] as const,
    rewards: (shopId: string, range: string) => ["analytics", "rewards", shopId, range] as const,
    breakdown: (shopId: string, range: string, dimension: string) =>
      ["analytics", "breakdown", shopId, range, dimension] as const,
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
    /** Full rows (with each one's wait-alert threshold), not just the id set. */
    rows: () => ["favorites", "rows"] as const,
  },
  reminder: {
    mine: () => ["customer-reminder", "mine"] as const,
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
  expenses: {
    byShop: (shopId: string) => ["shop-expenses", shopId] as const,
  },
  transactions: {
    serials: (shopId: string) => ["transactions", "serials", shopId] as const,
    manual: (shopId: string) => ["transactions", "manual", shopId] as const,
    expenses: (shopId: string) => ["transactions", "expenses", shopId] as const,
    appointments: (shopId: string) => ["transactions", "appointments", shopId] as const,
  },
  hairstyles: {
    byKind: (kind: string) => ["hairstyles", kind] as const,
  },
  stylePick: {
    bySerial: (serialId: string) => ["style-pick", serialId] as const,
  },
  serviceStyles: {
    /** The whole shop's offerings, for the provider's editor. */
    byShop: (shopId: string) => ["service-styles", "shop", shopId] as const,
    /**
     * What a customer sees for the services they have selected. Keyed on the
     * sorted id list so picking the same two services in either order hits one
     * cache entry rather than two.
     */
    forServices: (serviceIds: string[]) =>
      ["service-styles", "services", serviceIds.slice().sort()] as const,
    /** The platform catalogue. Not shop-scoped — it is the same for everyone. */
    catalogue: () => ["service-styles", "catalogue"] as const,
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
  admin: {
    isAdmin: () => ["admin", "is-admin"] as const,
    overview: () => ["admin", "overview"] as const,
    shops: (filters: {
      status: string | null;
      businessType: string | null;
      search: string;
      pageSize: number;
    }) => ["admin", "shops", filters] as const,
    shopDetail: (shopId: string) => ["admin", "shop", shopId] as const,
    recentShops: (days: number) => ["admin", "recent-shops", days] as const,
    auditFeed: (action: string | null) => ["admin", "audit", action] as const,
    hairstyles: () => ["admin", "hairstyles"] as const,
    users: (filters: {
      role: string | null;
      blocked: boolean | null;
      search: string;
      pageSize: number;
    }) => ["admin", "users", filters] as const,
    userDetail: (userId: string) => ["admin", "user", userId] as const,
    reports: (status: string | null) => ["admin", "reports", status] as const,
    identity: () => ["admin", "identity"] as const,
    admins: () => ["admin", "admins"] as const,
    tickets: (filters: { status: string | null; search: string }) =>
      ["admin", "tickets", filters] as const,
    ticketCounts: () => ["admin", "ticket-counts"] as const,
    /**
     * Not admin-scoped in the key, because the value is not admin-only: the
     * provider's loyalty form reads the same platform default to show what it
     * is starting from. One key so both screens share one cache entry.
     */
    platformLoyaltyDefault: () => ["platform-settings", "loyalty-default"] as const,
  },
  support: {
    myTickets: () => ["support", "my-tickets"] as const,
    ticket: (ticketId: string) => ["support", "ticket", ticketId] as const,
    messages: (ticketId: string) => ["support", "messages", ticketId] as const,
  },
  /**
   * AI Sprint 3. One proposal, fetched by id.
   *
   * No "mine" listing key on purpose: the card only ever renders the proposal
   * the assistant just produced, and the id arrives in a response header. A
   * list would be a screen nobody asked for, holding a log of what somebody
   * said to an AI.
   */
  aiActions: {
    proposal: (actionId: string) => ["ai-actions", "proposal", actionId] as const,
  },
  chatThreads: {
    mine: () => ["chat-threads", "mine"] as const,
    byShop: (shopId: string) => ["chat-threads", "shop", shopId] as const,
    unreadCountMine: () => ["chat-threads", "unread-count", "mine"] as const,
    unreadCountByShop: (shopId: string) => ["chat-threads", "unread-count", "shop", shopId] as const,
  },
} as const;