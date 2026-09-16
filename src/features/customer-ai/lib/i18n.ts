import type { Dict } from "@/lib/i18n";

/**
 * The confirmation card's words.
 *
 * Every string here is doing one of two jobs: describing what is about to
 * happen, or saying clearly that it has not happened yet. The second is the one
 * that matters — the whole risk of this feature is a customer reading a
 * description as a receipt, going home, and nobody at the shop expecting them.
 * So "এখনো লাইনে ঢোকানো হয়নি" is on the card itself, not only in the
 * assistant's sentence above it.
 */
export const customerAiDict = {
  // --- the card, before confirming -----------------------------------------
  proposalTitle: { bn: "লাইনে ঢুকবে?", en: "Join the queue?" },
  /** The line that keeps a description from reading as a receipt. */
  notYetJoined: {
    bn: "এখনো লাইনে ঢোকানো হয়নি — নিচের বাটনে চাপ দিলে তবেই হবে।",
    en: "You are not in the queue yet — only the button below does that.",
  },
  shopLabel: { bn: "দোকান", en: "Shop" },
  serviceLabel: { bn: "সার্ভিস", en: "Service" },
  priceLabel: { bn: "দাম", en: "Price" },
  waitLabel: { bn: "আনুমানিক অপেক্ষা", en: "Estimated wait" },
  aheadLabel: { bn: "সামনে আছে", en: "Ahead of you" },
  /** Shown instead of a figure. Never a guess — see AI_ARCHITECTURE §৭খ. */
  priceUnavailable: { bn: "দাম দেওয়া নেই", en: "Price not listed" },
  waitUnknown: { bn: "জানা যায়নি", en: "Not known" },
  noWait: { bn: "কোনো অপেক্ষা নেই", en: "No wait" },
  minutes: { bn: (n: string) => `${n} মিনিট`, en: (n: string) => `${n} min` },
  people: { bn: (n: string) => `${n} জন`, en: (n: string) => `${n} waiting` },
  taka: { bn: (n: string) => `৳${n}`, en: (n: string) => `৳${n}` },

  confirmCta: { bn: "নিশ্চিত করে লাইনে ঢোকাও", en: "Confirm & join queue" },
  cancelCta: { bn: "বাতিল", en: "Cancel" },
  expiresIn: {
    bn: (n: string) => `${n} সেকেন্ড বাকি`,
    en: (n: string) => `${n}s left`,
  },

  // --- outcomes -------------------------------------------------------------
  executing: { bn: "লাইনে ঢোকানো হচ্ছে…", en: "Joining the queue…" },
  successTitle: { bn: "লাইনে ঢোকানো হয়েছে", en: "You're in the queue" },
  successAt: {
    bn: (shop: string) => `${shop}-এ তোমার সিরিয়াল হয়ে গেছে।`,
    en: (shop: string) => `Your serial at ${shop} is confirmed.`,
  },
  positionLabel: { bn: "সিরিয়াল নম্বর", en: "Your number" },
  seeSerial: { bn: "আমার সিরিয়াল দেখো", en: "View my serial" },

  cancelledTitle: { bn: "বাতিল করা হয়েছে", en: "Cancelled" },
  cancelledBody: {
    bn: "কিছু করা হয়নি — লাইনে ঢোকানো হয়নি।",
    en: "Nothing happened — you were not added to the queue.",
  },

  expiredTitle: { bn: "সময় পেরিয়ে গেছে", en: "This expired" },
  expiredBody: {
    bn: "লাইনের হিসাবটা পুরনো হয়ে গেছে, তাই আর ব্যবহার করা যাবে না — আরেকবার জিজ্ঞেস করো।",
    en: "The queue figures are out of date, so this can no longer be used — just ask again.",
  },

  failedTitle: { bn: "হলো না", en: "It didn't work" },
  /** Generic; the server's own sentence is preferred when it sends one. */
  failedBody: { bn: "সিরিয়াল নেওয়া গেল না।", en: "The queue join did not go through." },
  retry: { bn: "আবার চেষ্টা করো", en: "Try again" },

  loadingProposal: { bn: "তৈরি হচ্ছে…", en: "Preparing…" },
} satisfies Dict;
