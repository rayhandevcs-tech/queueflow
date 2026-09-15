import type { Dict } from "@/lib/i18n";

export const loyaltyDict = {
  // ---- Owner: page shell ----
  ownerTitle: { bn: "লয়্যালটি পয়েন্ট", en: "Loyalty points" },
  ownerSubtitle: {
    bn: "নিয়মিত কাস্টমার প্রতিবার কাজ করালে পয়েন্ট জমে। কার কত জমেছে, সব এখানে।",
    en: "Regulars earn points every time they're served. Who has how many, all here.",
  },

  // ---- Owner: the switch ----
  settingsHeading: { bn: "প্রোগ্রামের নিয়ম", en: "Programme rules" },
  enabledLabel: { bn: "পয়েন্ট চালু", en: "Points on" },
  disabledLabel: { bn: "পয়েন্ট বন্ধ", en: "Points off" },
  enabledHint: {
    bn: "কাজ শেষ হলেই কাস্টমারের পয়েন্ট জমবে। বন্ধ থাকলে কাস্টমার কোথাও কিছু দেখবে না।",
    en: "Points land as soon as a job is finished. While it's off, customers see nothing anywhere.",
  },
  offNoticeTitle: { bn: "প্রোগ্রামটা এখনো বন্ধ", en: "The programme is off" },
  offNoticeBody: {
    bn: "চালু করলে এই দোকানে কাজ শেষ হওয়া প্রতিটা বিলে কাস্টমারের পয়েন্ট জমবে। আগে জমা পয়েন্ট কোথাও হারায় না — বন্ধ রাখলে শুধু নতুন পয়েন্ট জমা বন্ধ থাকে।",
    en: "Switch it on and every finished bill earns the customer points. Points already earned are never lost — switching off only stops new ones.",
  },
  rateLabel: { bn: "কত টাকায় ১ পয়েন্ট", en: "Taka per point" },
  rateHint: {
    bn: "যেমন ১০০ দিলে — প্রতি ১০০ টাকা বিলে ১ পয়েন্ট।",
    en: "Put 100 and every ৳100 of bill earns one point.",
  },
  minBillLabel: { bn: "সর্বনিম্ন বিল", en: "Minimum bill" },
  minBillHint: {
    bn: "এর নিচের বিলে কোনো পয়েন্ট জমবে না। ০ দিলে সব বিলেই জমবে।",
    en: "Bills below this earn nothing. Put 0 and every bill earns.",
  },
  previewHeading: { bn: "তাহলে হিসাবটা দাঁড়ায়", en: "Which works out as" },
  previewRow: {
    bn: (bill: string, points: string) => `৳${bill} বিলে ${points} পয়েন্ট`,
    en: (bill: string, points: string) => `A ৳${bill} bill earns ${points} point(s)`,
  },
  previewBelowFloor: {
    bn: (bill: string) => `৳${bill} সর্বনিম্ন বিলের নিচে — কিছু জমবে না`,
    en: (bill: string) => `৳${bill} is under your minimum — nothing earned`,
  },
  settingsSave: { bn: "রাখো", en: "Save" },
  settingsSaving: { bn: "রাখা হচ্ছে…", en: "Saving…" },
  cancel: { bn: "বাতিল", en: "Cancel" },
  editRules: { bn: "নিয়ম বদলাও", en: "Edit rules" },
  currentRule: {
    bn: (rate: string) => `প্রতি ৳${rate}-এ ১ পয়েন্ট`,
    en: (rate: string) => `1 point per ৳${rate}`,
  },
  currentFloor: {
    bn: (min: string) => `সর্বনিম্ন বিল ৳${min}`,
    en: (min: string) => `Minimum bill ৳${min}`,
  },
  noFloor: { bn: "সব বিলেই জমে", en: "Every bill earns" },

  // ---- Owner: tiles ----
  tileMembers: { bn: "পয়েন্ট আছে যাদের", en: "Holding points" },
  tileOutstanding: { bn: "বকেয়া পয়েন্ট", en: "Points outstanding" },
  tileLifetime: { bn: "মোট দেওয়া পয়েন্ট", en: "Points ever given" },
  tileTop: { bn: "সবচেয়ে বেশি", en: "Highest balance" },

  // ---- Owner: the table ----
  membersHeading: { bn: "কার কত পয়েন্ট", en: "Who has what" },
  colCustomer: { bn: "কাস্টমার", en: "Customer" },
  colBalance: { bn: "পয়েন্ট", en: "Points" },
  colLifetime: { bn: "মোট কামিয়েছে", en: "Earned in total" },
  colLastEarned: { bn: "শেষ জমা", en: "Last earned" },
  noMembersTitle: { bn: "এখনো কারো পয়েন্ট জমেনি", en: "Nobody has points yet" },
  noMembersDesc: {
    bn: "প্রোগ্রাম চালু থাকলে পরের কাজ শেষ হওয়ামাত্র প্রথম পয়েন্ট জমবে।",
    en: "With the programme on, the first points land the moment the next job is finished.",
  },
  loadFailed: {
    bn: "আনা গেল না। একটু পরে আবার চেষ্টা করো।",
    en: "Couldn't load that. Try again in a moment.",
  },
  noName: { bn: "নাম দেওয়া হয়নি", en: "No name given" },
  points: {
    bn: (n: string) => `${n} পয়েন্ট`,
    en: (n: string) => `${n} points`,
  },

  // ---- Owner: one customer's drawer ----
  drawerTitle: { bn: "পয়েন্টের হিসাব", en: "Point history" },
  historyHeading: { bn: "কোথা থেকে এলো", en: "Where they came from" },
  historyEmpty: { bn: "কোনো লেনদেন নেই।", en: "No entries yet." },
  kindEARN_SERIAL: { bn: "সিরিয়াল থেকে", en: "From a queue job" },
  kindEARN_APPOINTMENT: { bn: "অ্যাপয়েন্টমেন্ট থেকে", en: "From an appointment" },
  kindADJUST: { bn: "হাতে সংশোধন", en: "Manual correction" },
  // Sprint 8 — referral pays into this same ledger, so the two sides need
  // names here rather than a separate history screen.
  kindREFERRAL_REFERRER: { bn: "রেফারেল — কাউকে এনেছে", en: "Referral — brought someone" },
  kindREFERRAL_REFERRED: { bn: "রেফারেল — কোড দিয়ে এসেছে", en: "Referral — arrived with a code" },
  fromBill: {
    bn: (bill: string) => `৳${bill} বিলে`,
    en: (bill: string) => `on a ৳${bill} bill`,
  },

  // ---- Owner: manual adjust ----
  adjustCta: { bn: "হাতে ঠিক করো", en: "Adjust by hand" },
  adjustTitle: { bn: "পয়েন্ট ঠিক করো", en: "Adjust points" },
  adjustHint: {
    bn: "ভুল হয়ে থাকলে এখানে ঠিক করো। যোগ করতে ধনাত্মক, কমাতে ঋণাত্মক সংখ্যা দাও — লেজারে কারণসহ লেখা থাকবে।",
    en: "Fix a mistake here. Positive to add, negative to remove — the ledger keeps the reason.",
  },
  adjustPointsLabel: { bn: "কত পয়েন্ট (+/−)", en: "How many points (+/−)" },
  adjustNoteLabel: { bn: "কারণ", en: "Reason" },
  adjustNotePlaceholder: { bn: "যেমন: ভুলে কম বসেছিল", en: "e.g. was short by mistake" },
  adjustSubmit: { bn: "ঠিক করো", en: "Adjust" },
  adjustDone: { bn: "পয়েন্ট ঠিক করা হয়েছে।", en: "Points adjusted." },
  adjustNotRedemption: {
    bn: "এটা পুরস্কার দেওয়ার ব্যবস্থা নয় — শুধু সংশোধন। পয়েন্ট খরচ করে পুরস্কার নেওয়ার সুবিধা পরে আসবে।",
    en: "This isn't redemption — it's a correction. Spending points on rewards comes later.",
  },
  balanceNow: {
    bn: (n: string) => `এখন ${n} পয়েন্ট`,
    en: (n: string) => `${n} points now`,
  },

  // ---- Customer: profile cards ----
  profileHeading: { bn: "পয়েন্ট", en: "Points" },
  profileIntro: {
    bn: "প্রতিটা দোকানের পয়েন্ট আলাদা — এক দোকানের পয়েন্ট অন্য দোকানে চলে না।",
    en: "Each shop's points are its own — points at one shop don't work at another.",
  },
  cardBalance: {
    bn: (n: string) => `${n} পয়েন্ট`,
    en: (n: string) => `${n} points`,
  },
  cardLifetime: {
    bn: (n: string) => `মোট কামিয়েছ ${n}`,
    en: (n: string) => `${n} earned in total`,
  },
  cardRate: {
    bn: (rate: string) => `প্রতি ৳${rate}-এ ১`,
    en: (rate: string) => `1 per ৳${rate}`,
  },
  cardPaused: { bn: "দোকান আপাতত বন্ধ রেখেছে", en: "The shop has paused this" },
  cardPausedHint: {
    bn: "জমা পয়েন্ট থেকেই যাবে, নতুন জমছে না।",
    en: "What you've earned stays; nothing new is being added.",
  },
  lastEarnedOn: {
    bn: (date: string) => `শেষ জমেছে ${date}`,
    en: (date: string) => `Last earned ${date}`,
  },
  notRedeemableYet: {
    bn: "পয়েন্ট দিয়ে পুরস্কার নেওয়ার সুবিধা এখনো আসেনি — দোকানে জিজ্ঞেস করে নিতে পারো।",
    en: "Spending points on rewards isn't available yet — ask at the shop.",
  },
} satisfies Dict;
