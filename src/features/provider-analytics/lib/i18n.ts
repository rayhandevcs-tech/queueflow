import type { Dict } from "@/lib/i18n";

export const providerAnalyticsDict = {
  peakBadge: { bn: "পিক", en: "Peak" },
  customerAnalyticsTitle: { bn: "কাস্টমার অ্যানালিটিক্স", en: "Customer analytics" },
  analyticsSubtitle: {
    bn: "কখন কেমন চাপ থাকে বুঝে নাও — কর্মী ও সময় পরিকল্পনা করো",
    en: "See when it gets busy — plan your staff and hours around it",
  },
  dailyAvgCustomers: { bn: "দৈনিক গড় কাস্টমার", en: "Daily avg. customers" },
  peakTime: { bn: "পিক টাইম", en: "Peak time" },
  beforeMorning8: { bn: "সকাল ৮টার আগে", en: "Before 8am" },
  noneYet: { bn: "এখনো নেই", en: "None yet" },
  avgServiceTime: { bn: "গড় সার্ভিস সময়", en: "Avg. service time" },
  minShort: { bn: "মি", en: "m" },
  notEnoughData: {
    bn: "এখনো যথেষ্ট কাজ সম্পন্ন হয়নি — কাজ চলতে থাকলে এখানে সময়ভিত্তিক চাপ আর ইনসাইট দেখা যাবে।",
    en: "Not enough jobs completed yet — keep going and time-based load and insights will show up here.",
  },
  loadByTime: { bn: "সময় অনুযায়ী কাস্টমার চাপ (গত ৯০ দিন)", en: "Customer load by time (last 90 days)" },
  weeklyLoad: { bn: "সাপ্তাহিক চাপ", en: "Weekly load" },
  insights: { bn: "ইনসাইট", en: "Insights" },
  noInsightsYet: { bn: "এখনো ইনসাইট তৈরি করার মতো ডেটা নেই।", en: "Not enough data for insights yet." },

  // -------------------------------------------------------------------------
  // Sprint 10 — the business dashboard
  // -------------------------------------------------------------------------
  dashTitle: { bn: "ব্যবসার হিসাব", en: "Business analytics" },
  dashSubtitle: {
    bn: "নিজের দোকানের সংখ্যাগুলো এক জায়গায় — সময়সীমা বেছে নাও",
    en: "Your shop's own numbers in one place — pick a period",
  },

  // range picker
  rangeLabel: { bn: "সময়সীমা", en: "Period" },
  presetToday: { bn: "আজ", en: "Today" },
  preset7: { bn: "৭ দিন", en: "7 days" },
  preset30: { bn: "৩০ দিন", en: "30 days" },
  presetMonth: { bn: "এ মাস", en: "This month" },
  presetCustom: { bn: "নিজে বাছো", en: "Custom" },
  customFrom: { bn: "শুরু", en: "From" },
  customTo: { bn: "শেষ", en: "To" },
  rangeReversed: { bn: "শেষ তারিখ শুরুর আগে হতে পারে না।", en: "The end date cannot be before the start." },
  rangeTooWide: { bn: "সময়সীমা সর্বোচ্চ ৩ বছর পর্যন্ত হতে পারে।", en: "A period can span at most 3 years." },
  rangeMalformed: { bn: "তারিখ দুটো ঠিকভাবে বাছো।", en: "Pick both dates." },
  rangeShown: {
    bn: (from: string, to: string) => `${from} – ${to}`,
    en: (from: string, to: string) => `${from} – ${to}`,
  },
  rangeDayCount: {
    bn: (n: string) => `${n} দিন`,
    en: (n: string) => `${n} days`,
  },
  rangeFuture: {
    bn: "সময়সীমা ভবিষ্যতে যাচ্ছে — আসন্ন বুকিং ছাড়া ওই দিনগুলো খালি থাকবে।",
    en: "This period runs into the future — those days will be empty apart from upcoming bookings.",
  },

  // states
  na: { bn: "প্রযোজ্য নয়", en: "N/A" },
  naShort: { bn: "—", en: "—" },
  naWhy: {
    bn: "হিসাব করার মতো ডেটা নেই — শূন্য নয়, অজানা।",
    en: "There is nothing to calculate from — not zero, unknown.",
  },
  loadFailed: { bn: "সংখ্যাগুলো আনা যায়নি।", en: "Could not load these numbers." },
  retry: { bn: "আবার চেষ্টা করো", en: "Try again" },
  emptyRange: {
    bn: "এই সময়সীমায় কোনো কাজ হয়নি।",
    en: "Nothing happened in this period.",
  },

  // overview
  sectionOverview: { bn: "সারসংক্ষেপ", en: "Overview" },
  tileRevenue: { bn: "মোট ব্যবসা", en: "Total business" },
  tileCollected: { bn: "হাতে এসেছে", en: "Collected" },
  tileDue: { bn: "বাকি", en: "Due" },
  tileJobs: { bn: "সম্পন্ন কাজ", en: "Completed jobs" },
  tileAvgTicket: { bn: "গড় বিল", en: "Avg. bill" },
  tileCustomers: { bn: "কাস্টমার", en: "Customers" },
  tileNew: { bn: "নতুন", en: "New" },
  tileReturning: { bn: "ফিরে আসা", en: "Returning" },
  tileRepeat: { bn: "একাধিকবার এসেছে", en: "Came more than once" },
  tileWalkIns: { bn: "ওয়াক-ইন", en: "Walk-ins" },
  hintOfTotal: {
    bn: (pct: string) => `মোটের ${pct}%`,
    en: (pct: string) => `${pct}% of total`,
  },
  hintOfCustomers: {
    bn: (pct: string) => `কাস্টমারের ${pct}%`,
    en: (pct: string) => `${pct}% of customers`,
  },
  revenueNote: {
    bn: "মোট ব্যবসা = সম্পন্ন সিরিয়াল + অ্যাপয়েন্টমেন্ট + ম্যানুয়াল এন্ট্রি, ইনকাম পেজের মতোই। রিওয়ার্ড ছাড় বাদ দেওয়ার পরের অঙ্ক।",
    en: "Total business = completed serials + appointments + manual entries, exactly as on the income page. Amounts are after any reward discount.",
  },

  // retention
  sectionRetention: { bn: "কাস্টমার ধরে রাখা", en: "Customer retention" },
  retentionNote: {
    bn: "“ফিরে আসা” মানে এই সময়সীমার আগেও এই দোকানে কাজ করিয়েছে। “একাধিকবার” মানে এই সময়সীমার ভেতরেই একবারের বেশি এসেছে।",
    en: "“Returning” means they had finished work here before this period. “More than once” means they came twice or more inside it.",
  },

  // trend
  sectionTrend: { bn: "আয়ের ধারা", en: "Revenue trend" },
  trendDaily: { bn: "দিন অনুযায়ী", en: "By day" },
  trendMonthly: { bn: "মাস অনুযায়ী", en: "By month" },
  trendBest: {
    bn: (day: string, amount: string) => `সবচেয়ে ভালো: ${day} — ৳${amount}`,
    en: (day: string, amount: string) => `Best: ${day} — ৳${amount}`,
  },
  trendPerDay: { bn: "দৈনিক গড়", en: "Per day" },
  trendPerMonth: { bn: "মাসিক গড়", en: "Per month" },

  // appointments
  sectionAppointments: { bn: "অ্যাপয়েন্টমেন্ট", en: "Appointments" },
  apTotal: { bn: "মোট", en: "Total" },
  apCompleted: { bn: "সম্পন্ন", en: "Completed" },
  apCancelled: { bn: "বাতিল", en: "Cancelled" },
  apNoShow: { bn: "আসেনি", en: "No-show" },
  apUpcoming: { bn: "আসন্ন", en: "Upcoming" },
  apCompletionRate: { bn: "সম্পন্নের হার", en: "Completion rate" },
  apNoShowRate: { bn: "না-আসার হার", en: "No-show rate" },
  apCancelRate: { bn: "বাতিলের হার", en: "Cancel rate" },
  apAvgMinutes: { bn: "গড় সময় (নির্ধারিত)", en: "Avg. booked length" },
  apLeadDays: { bn: "কত দিন আগে বুক হয়", en: "Booked this far ahead" },
  apRateNote: {
    bn: "তিনটে হার হিসাব হয় শেষ হওয়া বুকিং থেকে (সম্পন্ন + বাতিল + আসেনি) — অপেক্ষায় থাকা স্লট এখনো সফল বা ব্যর্থ কোনোটাই নয়।",
    en: "The three rates are shares of bookings that finished (completed + cancelled + no-show) — a slot still upcoming has neither succeeded nor failed.",
  },
  apNotUsed: {
    bn: "এই দোকান অ্যাপয়েন্টমেন্ট নেয় না, তাই এখানে দেখানোর কিছু নেই।",
    en: "This shop does not take appointments, so there is nothing to show here.",
  },
  daysShort: { bn: "দিন", en: "d" },

  // queue
  sectionQueue: { bn: "লাইভ কিউ", en: "Live queue" },
  qTotal: { bn: "মোট সিরিয়াল", en: "Serials" },
  qCompleted: { bn: "সম্পন্ন", en: "Completed" },
  qAvgService: { bn: "গড় সার্ভিস সময়", en: "Avg. service time" },
  qAvgWait: { bn: "গড় অপেক্ষা", en: "Avg. wait" },
  qBusiestDay: { bn: "সবচেয়ে ব্যস্ত দিন", en: "Busiest day" },
  qNotUsed: {
    bn: "এই দোকান লাইভ কিউ চালায় না, তাই এখানে দেখানোর কিছু নেই।",
    en: "This shop does not run a live queue, so there is nothing to show here.",
  },
  qWaitNote: {
    bn: "অপেক্ষা মাপা হয় বুকিং থেকে কাজ শুরুর সময় পর্যন্ত, আর সার্ভিস সময় শুরু থেকে শেষ পর্যন্ত — দুটোই আসল টাইমস্ট্যাম্প, কোনো অনুমান নয়।",
    en: "Wait is measured from booking to the moment work started, and service time from start to finish — both from real timestamps, nothing estimated.",
  },

  // staff
  sectionStaff: { bn: "চেয়ার/স্টাফের হিসাব", en: "Staff performance" },
  staffSeat: { bn: "চেয়ার", en: "Seat" },
  staffJobs: { bn: "কাজ", en: "Jobs" },
  staffRevenue: { bn: "ব্যবসা", en: "Business" },
  staffBooked: { bn: "বুক হওয়া সময়", en: "Booked time" },
  staffRoster: { bn: "নির্ধারিত সময়", en: "Rostered time" },
  staffUtilization: { bn: "ব্যবহার", en: "Utilization" },
  staffMissed: { bn: "বাতিল/আসেনি", en: "Cancelled/no-show" },
  staffPooled: {
    bn: (pct: string) => `সব চেয়ার মিলিয়ে ব্যবহার ${pct}%`,
    en: (pct: string) => `${pct}% utilization across all seats`,
  },
  staffNoRoster: {
    bn: "সময়সূচি দেওয়া নেই",
    en: "No hours set",
  },
  staffUtilNote: {
    bn: "ব্যবহার = বুক হওয়া মিনিট ÷ নির্ধারিত কাজের মিনিট। যে চেয়ারের সাপ্তাহিক সময়সূচি দেওয়া নেই তার ব্যবহার “প্রযোজ্য নয়” — অনুমান করা কোনো হিসাব এখানে বসানো হয়নি।",
    en: "Utilization = booked minutes ÷ rostered minutes. A seat with no weekly hours set reads N/A — no assumed denominator is used.",
  },
  staffNone: {
    bn: "এই দোকানে এখনো কোনো চেয়ার নেই।",
    en: "This shop has no seats yet.",
  },
  hoursShort: { bn: "ঘ", en: "h" },

  // peak slots
  sectionPeak: { bn: "ব্যস্ত সময়", en: "Peak times" },
  peakQueue: { bn: "কিউ", en: "Queue" },
  peakAppointments: { bn: "অ্যাপয়েন্টমেন্ট", en: "Appointments" },
  peakByHour: { bn: "ঘণ্টা অনুযায়ী", en: "By hour" },
  peakByWeekday: { bn: "বার অনুযায়ী", en: "By weekday" },
  peakBusiest: {
    bn: (label: string, jobs: string) => `সবচেয়ে ব্যস্ত: ${label} (${jobs})`,
    en: (label: string, jobs: string) => `Busiest: ${label} (${jobs})`,
  },
  peakNote: {
    bn: "যা হয়েছে তার হিসাব — কোনো পূর্বাভাস নয়। অ্যাপয়েন্টমেন্টের ব্যস্ততা মাপা হয় স্লটের সময় ধরে (বাতিল বাদ, কিন্তু না-আসা ধরা — আসন তো রাখা হয়েছিল), আর কিউয়ের ব্যস্ততা কাজ শেষ হওয়ার সময় ধরে।",
    en: "A record of what happened, not a forecast. Appointment demand is counted at the slot time (cancellations excluded, no-shows included — the seat was still held), and queue load at the time work finished.",
  },
  hourRange: {
    bn: (from: string, to: string) => `${from}–${to}টা`,
    en: (from: string, to: string) => `${from}–${to}`,
  },
  /**
   * Postgres `isodow`: 1 = Monday … 7 = Sunday. Indexed by that number rather
   * than by `Date.getDay()` so the label cannot drift from the SQL that
   * produced the bucket. An out-of-range value returns "—" instead of
   * `undefined` leaking into the chart.
   */
  weekdayIso: {
    bn: (iso: number) =>
      ["সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি", "রবি"][iso - 1] ?? "—",
    en: (iso: number) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][iso - 1] ?? "—",
  },

  // loyalty
  sectionLoyalty: { bn: "লয়্যালটি পয়েন্ট", en: "Loyalty" },
  loyAccounts: { bn: "পয়েন্ট অ্যাকাউন্ট", en: "Point accounts" },
  loyWithBalance: { bn: "পয়েন্ট আছে যাদের", en: "Holding points" },
  loyEarned: { bn: "এই সময়ে জমা", en: "Earned in period" },
  loyRedeemed: { bn: "এই সময়ে খরচ", en: "Redeemed in period" },
  loyAdjusted: { bn: "হাতে সংশোধন", en: "Manual adjustments" },
  loyOutstanding: { bn: "এখন বাকি পয়েন্ট", en: "Points outstanding" },
  loyReferralPoints: { bn: "রেফারেল থেকে", en: "From referrals" },
  loyTransactions: { bn: "লেজার এন্ট্রি", en: "Ledger entries" },
  loyOff: {
    bn: "লয়্যালটি এখন বন্ধ। চালু করলে এখানে জমা-খরচের হিসাব দেখা যাবে।",
    en: "Loyalty is switched off. Turn it on and the earn/spend figures will appear here.",
  },
  loyNote: {
    bn: "সব পয়েন্ট লয়্যালটি লেজার থেকে — বিল থেকে আলাদা করে হিসাব করা হয় না। “বাকি পয়েন্ট” আজকের অবস্থা, জমা-খরচ সময়সীমার ভেতরের হিসাব।",
    en: "Every figure comes from the loyalty ledger — none of it is recomputed from bills. “Outstanding” is today's balance; earn and spend are flows inside the period.",
  },
  pointsUnit: { bn: "পয়েন্ট", en: "pts" },

  // membership
  sectionMembership: { bn: "মেম্বারশিপ", en: "Membership" },
  memTiers: { bn: "প্যাকেজ", en: "Tiers" },
  memActive: { bn: "চালু সদস্য", en: "Active members" },
  memPending: { bn: "অপেক্ষায়", en: "Pending" },
  memExpired: { bn: "মেয়াদ শেষ", en: "Expired" },
  memCancelled: { bn: "বাতিল", en: "Cancelled" },
  memExpiringSoon: { bn: "শীঘ্রই শেষ হবে", en: "Expiring soon" },
  memNew: { bn: "এই সময়ে নতুন", en: "New in period" },
  memRevenue: { bn: "আদায় হয়েছে", en: "Collected" },
  memDue: { bn: "বাকি", en: "Due" },
  memNote: {
    bn: "মেম্বারশিপে অটো-রিনিউ বা অনলাইন গেটওয়ে নেই — নবায়ন মানে নতুন একটা সদস্যপদ। তাই এখানে কোনো “মাসিক আয়” দেখানো হয় না, শুধু যা সত্যিই আদায় হয়েছে।",
    en: "Membership has no auto-renewal and no online gateway — a renewal is a new membership row. So no recurring revenue is shown here, only what was actually collected.",
  },

  // referral
  sectionReferral: { bn: "রেফারেল", en: "Referral" },
  refCodes: { bn: "কোড নেওয়া হয়েছে", en: "Codes issued" },
  refTotal: { bn: "মোট রেফারেল", en: "Referrals" },
  refPending: { bn: "অপেক্ষায়", en: "Pending" },
  refConverted: { bn: "সফল", en: "Converted" },
  refRate: { bn: "সফলতার হার", en: "Conversion rate" },
  refReferrers: { bn: "যারা রেফার করেছে", en: "Active referrers" },
  refBrought: { bn: "নতুন কাস্টমার এসেছে", en: "Customers brought in" },
  refPoints: { bn: "পয়েন্ট দেওয়া হয়েছে", en: "Points awarded" },
  refOff: {
    bn: "রেফারেল এখন বন্ধ।",
    en: "Referral is switched off.",
  },
  refNote: {
    bn: "কোড ব্যবহার করলেই সফল ধরা হয় না — নতুন কাস্টমারের একটা কাজ সত্যিই সম্পন্ন হলে তবেই সফল।",
    en: "Claiming a code is not a conversion — a referral converts only when the new customer actually completes a job.",
  },

  // rewards
  sectionRewards: { bn: "রিওয়ার্ড", en: "Rewards" },
  rwTotal: { bn: "রিওয়ার্ড", en: "Rewards" },
  rwActive: { bn: "চালু", en: "Active" },
  rwAvailable: { bn: "এখন নেওয়া যায়", en: "Available now" },
  rwIssued: { bn: "হাতে আছে", en: "In pockets" },
  rwUsed: { bn: "ব্যবহৃত", en: "Used" },
  rwExpired: { bn: "মেয়াদ শেষ", en: "Expired" },
  rwUseRate: { bn: "ব্যবহারের হার", en: "Use rate" },
  rwPoints: { bn: "খরচ হওয়া পয়েন্ট", en: "Points spent" },
  rwDiscount: { bn: "দেওয়া ছাড়", en: "Discount given" },
  rwCustomers: { bn: "যারা নিয়েছে", en: "Redeeming customers" },
  rwNote: {
    bn: "ছাড়ের টাকা বিল থেকেই বাদ যায়, তাই উপরের “মোট ব্যবসা”-তে ছাড়-পরবর্তী অঙ্কই ধরা আছে। রিফান্ড ব্যবস্থা নেই, তাই রিফান্ডের কোনো হিসাবও নেই।",
    en: "A discount comes off the bill itself, so “total business” above already counts the post-discount amount. There is no refund flow, so there are no refund figures.",
  },

  // breakdowns
  sectionServices: { bn: "সার্ভিস অনুযায়ী", en: "By service" },
  sectionPayments: { bn: "পেমেন্ট অনুযায়ী", en: "By payment method" },
  sectionTiers: { bn: "প্যাকেজ অনুযায়ী", en: "By tier" },
  sectionPopularRewards: { bn: "জনপ্রিয় রিওয়ার্ড", en: "Popular rewards" },
  breakdownOther: {
    bn: (count: string, amount: string) => `আরও ${count}টি — ৳${amount}`,
    en: (count: string, amount: string) => `${count} more — ৳${amount}`,
  },
  serviceSplitNote: {
    bn: "একই বিলে কয়েকটা সার্ভিস থাকলে টাকা সমানভাগে ভাগ করা হয় — নইলে যোগফল দোকানের আসল আয়ের চেয়ে বেশি দেখাত।",
    en: "When one bill covers several services the money is split evenly — otherwise the column would add up to more than the shop earned.",
  },
  paymentDue: { bn: "বাকি", en: "Due" },
  paymentUnknown: { bn: "উল্লেখ নেই", en: "Not recorded" },

  // AI brief
  sectionAi: { bn: "AI ব্যবসা-বিশ্লেষণ", en: "AI business brief" },
  aiBody: {
    bn: "এই সংখ্যাগুলোর সাথে এখন অ্যাপয়েন্টমেন্ট, লয়্যালটি, মেম্বারশিপ, রেফারেল ও রিওয়ার্ডের হিসাবও AI সহকারীর ব্রিফে যায় — তাই প্রশ্ন করলে সে এই ড্যাশবোর্ডের ভিত্তিতেই উত্তর দেবে।",
    en: "Appointment, loyalty, membership, referral and reward figures now travel with the brief the AI assistant reads — so its answers rest on the same numbers as this dashboard.",
  },
  aiCta: { bn: "AI সহকারীতে যাও", en: "Open the AI assistant" },
} satisfies Dict;
