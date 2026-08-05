import type { Dict } from "@/lib/i18n";

export const providerQueueDict = {
  somethingWrong: { bn: "কিছু একটা ভুল হয়েছে", en: "Something went wrong" },

  // NowServingCard
  messageCustomerTitle: { bn: "কাস্টমারকে মেসেজ করো", en: "Message the customer" },
  cancelTitle: { bn: "ক্যানসেল করো", en: "Cancel" },
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
  paymentSheetTitle: { bn: "পেমেন্ট নিশ্চিত করো", en: "Confirm payment" },
  cashOption: { bn: "ক্যাশ", en: "Cash" },
  bkashOption: { bn: "বিকাশ", en: "bKash" },
  nagadOption: { bn: "নগদ", en: "Nagad" },
  rocketOption: { bn: "রকেট", en: "Rocket" },
  cardOption: { bn: "কার্ড", en: "Card" },
  dueOption: { bn: "বাকি", en: "Due" },
  confirmPaymentCta: { bn: "নিশ্চিত করো", en: "Confirm" },

  // WaitingRow
  walkInBadge: { bn: "ওয়াক-ইন", en: "Walk-in" },
  advancePaidBadge: { bn: "✓ অ্যাডভান্স পেইড", en: "✓ Advance paid" },
  startsInLabel: { bn: "শুরু হবে", en: "Starts in" },
  startCta: { bn: "শুরু", en: "Start" },
  noShowTitle: { bn: "নো-শো", en: "No-show" },

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
  backlogMin: {
    bn: (n: number) => `~${n} মিন ব্যাকলগ`,
    en: (n: number) => `~${n} min backlog`,
  },

  // WalkInDialog
  walkInCustomerTitle: { bn: "ওয়াক-ইন কাস্টমার", en: "Walk-in customer" },
  customerNamePlaceholder: { bn: "কাস্টমারের নাম *", en: "Customer name *" },
  phoneOptionalPlaceholder: { bn: "ফোন (ঐচ্ছিক)", en: "Phone (optional)" },
  servicesLabel: { bn: "সার্ভিস *", en: "Services *" },
  chairLabel: { bn: "চেয়ার", en: "Chair" },
  autoChair: { bn: "অটো", en: "Auto" },
  backlogSuffixMin: {
    bn: (n: number) => `~${n} মিন`,
    en: (n: number) => `~${n} min`,
  },
  adding: { bn: "যোগ হচ্ছে…", en: "Adding…" },
  addToQueue: { bn: "কিউতে যোগ করো", en: "Add to queue" },

  // EmptyLane
  noWaitingSerials: { bn: "কোনো অপেক্ষমাণ সিরিয়াল নেই 🎉", en: "No serials waiting 🎉" },

  // BoardHeader
  liveQueueHeading: { bn: "লাইভ সিরিয়াল", en: "Live queue" },
  todaySummary: {
    bn: (date: string, n: number) => `আজ ${date} · এখন ${n} জন অপেক্ষায়`,
    en: (date: string, n: number) => `Today ${date} · ${n} waiting now`,
  },
  realtimeUpdating: { bn: "রিয়েল-টাইম আপডেট হচ্ছে", en: "Updating in real time" },
  walkInCta: { bn: "ওয়াক-ইন", en: "Walk-in" },
} satisfies Dict;
