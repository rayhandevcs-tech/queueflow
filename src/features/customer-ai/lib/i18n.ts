import type { Dict } from "@/lib/i18n";

/**
 * The confirmation card's words, for all three actions.
 *
 * Every string here is doing one of two jobs: describing what is about to
 * happen, or saying clearly that it has not happened yet. The second is the one
 * that matters — the whole risk of this feature is a customer reading a
 * description as a receipt, going home, and nobody at the shop expecting them.
 * So each action has its own "nothing has happened yet" line, on the card
 * itself rather than only in the assistant's sentence above it, and each one
 * names the specific thing that has not happened. "Nothing has been done" is
 * vague enough to be read as reassurance; "এখনো লাইনে ঢোকানো হয়নি" is not.
 *
 * The three actions are spelled out separately rather than sharing a generic
 * noun, for the same reason `business-terms.ts` exists: "সময় নেওয়া হয়নি" and
 * "পয়েন্ট কাটা হয়নি" are different promises, and a customer confirming a
 * redemption should not be reading a sentence written about a queue.
 */
export const customerAiDict = {
  // --- shared ---------------------------------------------------------------
  shopLabel: { bn: "দোকান", en: "Shop" },
  serviceLabel: { bn: "সার্ভিস", en: "Service" },
  priceLabel: { bn: "দাম", en: "Price" },
  /** Shown instead of a figure. Never a guess — see AI_ARCHITECTURE §৭খ. */
  priceUnavailable: { bn: "দাম দেওয়া নেই", en: "Price not listed" },
  minutes: { bn: (n: string) => `${n} মিনিট`, en: (n: string) => `${n} min` },
  people: { bn: (n: string) => `${n} জন`, en: (n: string) => `${n} waiting` },
  taka: { bn: (n: string) => `৳${n}`, en: (n: string) => `৳${n}` },
  points: { bn: (n: string) => `${n} পয়েন্ট`, en: (n: string) => `${n} points` },
  cancelCta: { bn: "বাতিল", en: "Cancel" },
  expiresIn: {
    bn: (n: string) => `${n} সেকেন্ড বাকি`,
    en: (n: string) => `${n}s left`,
  },
  loadingProposal: { bn: "তৈরি হচ্ছে…", en: "Preparing…" },
  cancelledTitle: { bn: "বাতিল করা হয়েছে", en: "Cancelled" },
  expiredTitle: { bn: "সময় পেরিয়ে গেছে", en: "This expired" },
  failedTitle: { bn: "হলো না", en: "It didn't work" },
  retry: { bn: "আবার চেষ্টা করো", en: "Try again" },

  // --- JOIN_QUEUE -----------------------------------------------------------
  proposalTitle: { bn: "লাইনে ঢুকবে?", en: "Join the queue?" },
  /** The line that keeps a description from reading as a receipt. */
  notYetJoined: {
    bn: "এখনো লাইনে ঢোকানো হয়নি — নিচের বাটনে চাপ দিলে তবেই হবে।",
    en: "You are not in the queue yet — only the button below does that.",
  },
  waitLabel: { bn: "আনুমানিক অপেক্ষা", en: "Estimated wait" },
  aheadLabel: { bn: "সামনে আছে", en: "Ahead of you" },
  waitUnknown: { bn: "জানা যায়নি", en: "Not known" },
  noWait: { bn: "কোনো অপেক্ষা নেই", en: "No wait" },
  confirmCta: { bn: "নিশ্চিত করে লাইনে ঢোকাও", en: "Confirm & join queue" },
  executing: { bn: "লাইনে ঢোকানো হচ্ছে…", en: "Joining the queue…" },
  successTitle: { bn: "লাইনে ঢোকানো হয়েছে", en: "You're in the queue" },
  successAt: {
    bn: (shop: string) => `${shop}-এ তোমার সিরিয়াল হয়ে গেছে।`,
    en: (shop: string) => `Your serial at ${shop} is confirmed.`,
  },
  positionLabel: { bn: "সিরিয়াল নম্বর", en: "Your number" },
  seeSerial: { bn: "আমার সিরিয়াল দেখো", en: "View my serial" },
  cancelledBody: {
    bn: "কিছু করা হয়নি — লাইনে ঢোকানো হয়নি।",
    en: "Nothing happened — you were not added to the queue.",
  },
  expiredBody: {
    bn: "লাইনের হিসাবটা পুরনো হয়ে গেছে, তাই আর ব্যবহার করা যাবে না — আরেকবার জিজ্ঞেস করো।",
    en: "The queue figures are out of date, so this can no longer be used — just ask again.",
  },
  /** Generic; the server's own sentence is preferred when it sends one. */
  failedBody: { bn: "সিরিয়াল নেওয়া গেল না।", en: "The queue join did not go through." },

  // --- BOOK_APPOINTMENT -----------------------------------------------------
  apptTitle: { bn: "অ্যাপয়েন্টমেন্ট নেবে?", en: "Book this appointment?" },
  apptNotYetBooked: {
    bn: "এখনো বুক করা হয়নি, সময়টা ধরেও রাখা নেই — নিচের বাটনে চাপ দিলে তবেই হবে।",
    en: "Not booked yet, and the time is not being held — only the button below does that.",
  },
  dateLabel: { bn: "তারিখ", en: "Date" },
  timeLabel: { bn: "সময়", en: "Time" },
  durationLabel: { bn: "সময় লাগবে", en: "Takes" },
  staffLabel: { bn: "যিনি করবেন", en: "With" },
  apptConfirmCta: { bn: "নিশ্চিত করে বুক করো", en: "Confirm & book" },
  apptExecuting: { bn: "বুক করা হচ্ছে…", en: "Booking…" },
  apptSuccessTitle: { bn: "অ্যাপয়েন্টমেন্ট হয়ে গেছে", en: "Appointment booked" },
  apptSuccessAt: {
    bn: (shop: string) => `${shop}-এ তোমার সময় ঠিক হয়ে গেছে।`,
    en: (shop: string) => `Your time at ${shop} is confirmed.`,
  },
  /** Goes to `/my-serial`, which is where the appointment list actually is. */
  seeAppointments: { bn: "আমার বুকিং দেখো", en: "View my bookings" },
  apptCancelledBody: {
    bn: "কিছু করা হয়নি — কোনো সময় বুক করা হয়নি।",
    en: "Nothing happened — no appointment was booked.",
  },
  apptExpiredBody: {
    bn: "সময়টা অনেকক্ষণ ধরে রাখা যায় না, তাই এটা আর ব্যবহার করা যাবে না — আরেকবার খালি সময় দেখে নাও।",
    en: "A slot cannot be held for long, so this can no longer be used — just ask for the free times again.",
  },
  apptFailedBody: {
    bn: "অ্যাপয়েন্টমেন্ট নেওয়া গেল না।",
    en: "The booking did not go through.",
  },

  // --- REDEEM_REWARD --------------------------------------------------------
  rewardTitle: { bn: "রিওয়ার্ড নেবে?", en: "Redeem this reward?" },
  rewardNotYetSpent: {
    bn: "এখনো পয়েন্ট কাটা হয়নি — নিচের বাটনে চাপ দিলে তবেই হবে।",
    en: "No points have been spent yet — only the button below does that.",
  },
  rewardLabel: { bn: "রিওয়ার্ড", en: "Reward" },
  pointsCostLabel: { bn: "খরচ হবে", en: "Costs" },
  /** Named after the shop on purpose: points are per business. */
  balanceLabel: { bn: "এই দোকানে জমা আছে", en: "Your balance here" },
  balanceAfterLabel: { bn: "কাটার পর থাকবে", en: "Left after" },
  benefitLabel: { bn: "যা পাবে", en: "You get" },
  validUntilLabel: { bn: "মেয়াদ", en: "Valid until" },
  /** The three reward kinds, described from the row's own kind and value. */
  benefitFlat: { bn: (v: string) => `৳${v} ছাড়`, en: (v: string) => `৳${v} off` },
  benefitPct: { bn: (v: string) => `${v}% ছাড়`, en: (v: string) => `${v}% off` },
  benefitFreeService: {
    bn: (name: string) => `${name} ফ্রি`,
    en: (name: string) => `${name} free`,
  },
  rewardConfirmCta: { bn: "নিশ্চিত করে পয়েন্ট খরচ করো", en: "Confirm & spend points" },
  rewardExecuting: { bn: "রিওয়ার্ড নেওয়া হচ্ছে…", en: "Redeeming…" },
  rewardSuccessTitle: { bn: "রিওয়ার্ড নেওয়া হয়েছে", en: "Reward redeemed" },
  codeLabel: { bn: "কুপন কোড", en: "Coupon code" },
  pointsSpentLabel: { bn: "পয়েন্ট কাটা হয়েছে", en: "Points spent" },
  newBalanceLabel: { bn: "এখন জমা আছে", en: "New balance" },
  /**
   * The one thing a customer must understand about a coupon: redeeming it does
   * not itself take money off anything. They show the code at the counter.
   */
  couponHowTo: {
    bn: "কোডটা দোকানে দেখালে বিল থেকে ছাড় বসবে। এখনই কোনো বিল কমেনি।",
    en: "Show this code at the shop and the discount goes on your bill. Nothing has been discounted yet.",
  },
  /** Goes to `/profile`, where `MyCouponsCard` lives. */
  seeCoupons: { bn: "আমার কুপন দেখো", en: "View my coupons" },
  rewardCancelledBody: {
    bn: "কিছু করা হয়নি — কোনো পয়েন্ট কাটা হয়নি।",
    en: "Nothing happened — no points were spent.",
  },
  rewardExpiredBody: {
    bn: "পয়েন্ট আর রিওয়ার্ড দুটোই বদলাতে পারে, তাই এটা আর ব্যবহার করা যাবে না — আরেকবার জিজ্ঞেস করো।",
    en: "Both your points and the reward can change, so this can no longer be used — just ask again.",
  },
  rewardFailedBody: {
    bn: "রিওয়ার্ডটা নেওয়া গেল না।",
    en: "The redemption did not go through.",
  },
} satisfies Dict;
