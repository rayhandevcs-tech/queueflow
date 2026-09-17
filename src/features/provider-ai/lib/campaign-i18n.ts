import type { Dict } from "@/lib/i18n";

/**
 * The campaign approval card's words.
 *
 * A separate dict from `providerAiDict` on purpose: that one is about reading
 * numbers, and this one is about putting the shop's name to a message that
 * reaches other people. Mixing them would make the one vocabulary that has to
 * be careful harder to review.
 *
 * Three things in here are load-bearing rather than decorative, and they are
 * the reason this file is worth reading:
 *
 *   · `notYetSent` appears on the card the whole time it is open. §20: never
 *     show "Sent" before the broadcast function has actually succeeded. The
 *     owner should never have to wonder whether pressing nothing sent
 *     something;
 *
 *   · the LAPSED language. Every string here describes what the records say —
 *     "গত ৬০ দিনে আসেননি" — and none of them predicts. There is no "চলে
 *     যাবে", no "হারাতে পারো", no risk score. §23 forbids it, and this is
 *     where a careless word would become a claim the product cannot support;
 *
 *   · `sentBody` reports the number the SERVER returned, and says so when it
 *     is smaller than the approved audience. A customer who has muted
 *     promotions did not receive anything, and rounding that away would make
 *     the success message a small lie.
 */
export const providerCampaignDict = {
  // --- loading and lifecycle ------------------------------------------------
  loading: { bn: "ক্যাম্পেইন তৈরি হচ্ছে…", en: "Preparing the campaign…" },

  title: { bn: "ক্যাম্পেইন পাঠাবে?", en: "Send this campaign?" },
  reviewHint: {
    bn: "পাঠানোর আগে লেখাটা পড়ে নাও — তুমি না চাপলে কিছুই যাবে না।",
    en: "Read it before you send — nothing goes out until you press the button.",
  },

  // --- the rows -------------------------------------------------------------
  groupLabel: { bn: "কাদের কাছে", en: "Who gets it" },
  whyLabel: { bn: "কেন এঁরা", en: "Why these customers" },
  countLabel: { bn: "কতজন পাবে", en: "How many" },
  countValue: {
    bn: (n: string) => `${n} জন`,
    en: (n: string) => `${n} customers`,
  },
  mutedNote: {
    bn: (n: string) => `আরও ${n} জন এই গ্রুপে আছেন, কিন্তু তাঁরা প্রোমো বন্ধ রেখেছেন — তাঁদের কাছে যাবে না।`,
    en: (n: string) => `${n} more are in this group but have muted promotions — they will not receive it.`,
  },
  messageLabel: { bn: "বার্তা", en: "Message" },
  headlineLabel: { bn: "শিরোনাম", en: "Headline" },

  // --- the standing reminder -----------------------------------------------
  notYetSent: {
    bn: "এখনো কিছু পাঠানো হয়নি। তুমি “পাঠিয়ে দাও” চাপলেই কাস্টমারদের কাছে নোটিফিকেশন যাবে — এটা আর ফেরানো যাবে না।",
    en: "Nothing has been sent yet. Pressing Approve & Send delivers it to those customers, and it cannot be taken back.",
  },
  expiresIn: {
    bn: (s: string) => `${s} সেকেন্ড বাকি`,
    en: (s: string) => `${s}s left`,
  },
  dailyLimitNote: {
    bn: "দিনে একবারই প্রোমো পাঠানো যায় — নিজের হাতে পাঠানো নোটিফিকেশনও এই হিসাবে ধরা হয়।",
    en: "One promotional broadcast per day, and the manual one counts towards it too.",
  },

  // --- the three buttons ----------------------------------------------------
  editCta: { bn: "লেখা বদলাও", en: "Edit" },
  editDoneCta: { bn: "লেখা রাখো", en: "Keep this wording" },
  editCancelCta: { bn: "আগের লেখা ফেরাও", en: "Undo my changes" },
  approveCta: { bn: "পাঠিয়ে দাও", en: "Approve & send" },
  cancelCta: { bn: "থাক", en: "Cancel" },
  sending: { bn: "পাঠানো হচ্ছে…", en: "Sending…" },

  // --- editing ---------------------------------------------------------------
  editHint: {
    bn: "তুমি যা লিখবে সেটাই কাস্টমাররা পাবে। কাদের কাছে যাবে সেটা বদলানো যাবে না।",
    en: "What you write is what they receive. You cannot change who gets it.",
  },
  editedBadge: { bn: "তোমার লেখা", en: "Your wording" },
  titlePlaceholder: { bn: "শিরোনাম", en: "Headline" },
  bodyPlaceholder: { bn: "বার্তা", en: "Message" },
  titleTooLong: { bn: "শিরোনাম বড় হয়ে গেছে।", en: "That headline is too long." },
  bodyTooLong: { bn: "বার্তা বড় হয়ে গেছে।", en: "That message is too long." },
  emptyContent: { bn: "শিরোনাম আর বার্তা — দুটোই লাগবে।", en: "Both a headline and a message are needed." },
  charsLeft: {
    bn: (n: string) => `${n} অক্ষর বাকি`,
    en: (n: string) => `${n} characters left`,
  },

  // --- success ---------------------------------------------------------------
  sentTitle: { bn: "ক্যাম্পেইন পাঠানো হয়েছে", en: "Campaign sent" },
  sentBody: {
    bn: (n: string) => `${n} জনের কাছে নোটিফিকেশন গেছে।`,
    en: (n: string) => `The notification reached ${n} customers.`,
  },
  // Shown only when the delivered count is lower than the approved one. The
  // difference is people who muted promotions, and saying so is the whole
  // point of keeping the two numbers apart.
  sentFewerNote: {
    bn: (approved: string, sent: string) =>
      `${approved} জনের কথা ছিল, গেছে ${sent} জনের কাছে — বাকিরা প্রোমো বন্ধ রেখেছেন।`,
    en: (approved: string, sent: string) =>
      `${approved} were approved and ${sent} received it — the rest have muted promotions.`,
  },
  sentNoneNote: {
    bn: "কারো কাছে যায়নি — গ্রুপের সবাই প্রোমো বন্ধ রেখেছেন।",
    en: "Nobody received it — everybody in the group has muted promotions.",
  },

  // --- the other endings -----------------------------------------------------
  cancelledTitle: { bn: "পাঠানো হয়নি", en: "Not sent" },
  cancelledBody: {
    bn: "ক্যাম্পেইনটা বাতিল করা হয়েছে। কারো কাছে কিছু যায়নি।",
    en: "The campaign was cancelled. Nobody received anything.",
  },
  expiredTitle: { bn: "সময় পেরিয়ে গেছে", en: "This expired" },
  expiredBody: {
    bn: "কারা পাবে সেই তালিকাটা পুরনো হয়ে গেছে, তাই পাঠানো হয়নি। আরেকবার জিজ্ঞেস করলে নতুন তালিকা দেখাবে।",
    en: "The recipient list had gone stale, so nothing was sent. Ask again for a fresh one.",
  },
  failedTitle: { bn: "পাঠানো গেল না", en: "It could not be sent" },
  failedFallback: {
    bn: "ক্যাম্পেইনটা পাঠানো গেল না। কারো কাছে কিছু যায়নি।",
    en: "The campaign could not be sent. Nobody received anything.",
  },
  retryCta: { bn: "আবার চেষ্টা করো", en: "Try again" },
} satisfies Dict;
