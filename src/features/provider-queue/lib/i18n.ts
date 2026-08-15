import type { Dict } from "@/lib/i18n";

export const providerQueueDict = {
  somethingWrong: { bn: "কিছু একটা ভুল হয়েছে", en: "Something went wrong" },

  // NowServingCard
  messageCustomerTitle: { bn: "কাস্টমারকে মেসেজ করো", en: "Message the customer" },
  cancelTitle: { bn: "ক্যানসেল করো", en: "Cancel" },
  cancelSerialTitle: { bn: "সিরিয়ালটি বাতিল করবে?", en: "Cancel this serial?" },
  cancelSerialDesc: {
    bn: "কাস্টমার নোটিফিকেশন পাবে আর কিউ থেকে সরে যাবে। এটা ফেরানো যাবে না।",
    en: "The customer is notified and leaves the queue. This can't be undone.",
  },
  cancelSerialConfirm: { bn: "হ্যাঁ, বাতিল করো", en: "Yes, cancel" },
  keepSerial: { bn: "থাক", en: "Keep it" },
  nowServingPrefix: { bn: "এখন চলছে", en: "Now serving" },
  serialHash: {
    bn: (n: number) => `সিরিয়াল #${n}`,
    en: (n: number) => `Serial #${n}`,
  },
  remainingWord: { bn: "বাকি", en: "left" },
  jobDoneNext: { bn: "✓ কাজ সম্পন্ন — পরের জন", en: "✓ Job done — next" },
  extendedByLabel: {
    bn: (n: number) => `+${n} মিনিট বাড়ানো হয়েছে`,
    en: (n: number) => `+${n} min added`,
  },
  extendCustomLabel: { bn: "কাস্টম", en: "Custom" },
  extendCustomPlaceholder: { bn: "মিনিট", en: "Minutes" },
  extendConfirm: { bn: "যোগ করো", en: "Add" },
  extendCancel: { bn: "বাতিল", en: "Cancel" },

  // PaymentConfirmSheet
  paymentAskTitle: { bn: "টাকা পেয়েছ?", en: "Payment received?" },
  paidYesCta: { bn: "হ্যাঁ", en: "Yes" },
  paidNoCta: { bn: "না", en: "No" },
  choosePaymentMethod: { bn: "কোন মাধ্যমে?", en: "Which method?" },
  paymentBackCta: { bn: "← ফিরে যাও", en: "← Back" },
  cashOption: { bn: "ক্যাশ", en: "Cash" },
  bkashOption: { bn: "বিকাশ", en: "bKash" },
  nagadOption: { bn: "নগদ", en: "Nagad" },
  rocketOption: { bn: "রকেট", en: "Rocket" },
  cardOption: { bn: "কার্ড", en: "Card" },
  dueOption: { bn: "বাকি", en: "Due" },

  // WaitingRow
  walkInBadge: { bn: "অফ-লাইন", en: "Offline" },
  advancePaidBadge: { bn: "✓ অ্যাডভান্স পেইড", en: "✓ Advance paid" },
  startsInLabel: { bn: "শুরু হবে", en: "Starts in" },
  startCta: { bn: "শুরু", en: "Start" },
  noShowTitle: { bn: "নো-শো", en: "No-show" },
  arrivedBadge: { bn: "পৌঁছেছে", en: "Here" },
  arrivedTitle: { bn: "কাস্টমার দোকানে পৌঁছে গেছে", en: "Customer has arrived at the shop" },
  callCta: { bn: "ডাকলাম", en: "Call" },
  callTitle: {
    bn: "কাস্টমারকে ডাকা হয়েছে — ৫ মিনিট পর নো-শো দেওয়া যাবে",
    en: "Mark the customer as called — no-show unlocks 5 minutes later",
  },
  calledBadge: { bn: "ডাকা হয়েছে", en: "Called" },
  calledCountdown: {
    bn: (n: number) => `ডাকা হয়েছে · ${n} মিনিট`,
    en: (n: number) => `Called · ${n} min`,
  },
  bumpBackTitle: {
    bn: "একধাপ পিছিয়ে দাও — পরের জন আগে বসবে",
    en: "Bump one step back — the next person goes first",
  },

  // Party booking (Sprint 29)
  partyBadge: {
    bn: (index: number, size: number) => `দল ${index}/${size}`,
    en: (index: number, size: number) => `Party ${index}/${size}`,
  },
  settlePartyLabel: {
    bn: (n: number) => `দলের আরও ${n} জনের বিলও একসাথে নিচ্ছি`,
    en: (n: number) => `Also settling ${n} more from this party`,
  },
  settlePartyHint: {
    bn: (amount: number) => `তাদের বাকি ৳${amount} — এখনই আদায় ধরা হবে, বাকির খাতায় যাবে না।`,
    en: (amount: number) => `They still owe ৳${amount} — counted as collected now, not sent to the due ledger.`,
  },

  // MoveSerialMenu
  moveCta: { bn: "সরাও", en: "Move" },
  movingCta: { bn: "সরানো হচ্ছে…", en: "Moving…" },
  noEligibleChair: { bn: "সরানোর মতো কোনো চেয়ার নেই", en: "No eligible chair to move to" },
  closeMenuAria: { bn: "বন্ধ করো", en: "close" },

  // QueueBoard
  boardLoadFailed: { bn: "বোর্ড লোড করা যায়নি — পেজ রিফ্রেশ করো।", en: "Couldn't load the board — refresh the page." },
  noChairsTitle: { bn: "এখনো কোনো চেয়ার যোগ করা হয়নি", en: "No chairs added yet" },
  noChairsDesc: { bn: "লাইভ কিউ শুরু করতে একটা চেয়ার যোগ করো।", en: "Add a chair to start the live queue." },
  addChairCta: { bn: "চেয়ার যোগ করো →", en: "Add a chair →" },

  // ChairColumn
  chairClosed: { bn: "বন্ধ", en: "Closed" },
  // Just the number and unit: the badge around it already says "wait", and
  // the old "~12 মিন অপেক্ষা" ran into the staff name beside it on a phone.
  backlogMin: {
    bn: (n: number) => `${n} মিনিট`,
    en: (n: number) => `${n} min`,
  },
  backlogFree: { bn: "এখন খালি", en: "Free now" },
  waitLabelAria: { bn: "আনুমানিক অপেক্ষা", en: "Estimated wait" },

  // WalkInDialog
  walkInCustomerTitle: { bn: "অফ-লাইন কাস্টমার", en: "Offline customer" },
  customerNamePlaceholder: { bn: "কাস্টমারের নাম *", en: "Customer name *" },
  phoneOptionalPlaceholder: { bn: "ফোন (ঐচ্ছিক)", en: "Phone (optional)" },
  servicesLabel: { bn: "সার্ভিস *", en: "Services *" },
  serviceMinutes: {
    bn: (n: number) => `${n} মিনিট`,
    en: (n: number) => `${n} min`,
  },
  chairLabel: { bn: "চেয়ার", en: "Chair" },
  autoChair: { bn: "অটো", en: "Auto" },
  backlogSuffixMin: {
    bn: (n: number) => `~${n} মিন`,
    en: (n: number) => `~${n} min`,
  },
  adding: { bn: "যোগ হচ্ছে…", en: "Adding…" },
  addToQueue: { bn: "কিউতে যোগ করো", en: "Add to queue" },

  // EmptyLane
  noWaitingSerials: { bn: "কোনো কাস্টমার অপেক্ষায় নেই", en: "No customers waiting" },
  noWaitingSerialsDesc: {
    bn: "নতুন সিরিয়াল এলে এখানে দেখা যাবে।",
    en: "New serials will show up here as they come in.",
  },

  // BoardHeader
  liveQueueHeading: { bn: "লাইভ সিরিয়াল", en: "Live queue" },
  todaySummary: {
    bn: (date: string, n: number) => `আজ ${date} · এখন ${n} জন অপেক্ষায়`,
    en: (date: string, n: number) => `Today ${date} · ${n} waiting now`,
  },
  realtimeUpdating: { bn: "রিয়েল-টাইম আপডেট হচ্ছে", en: "Updating in real time" },
  walkInCta: { bn: "অফ-লাইন", en: "Offline" },
} satisfies Dict;
