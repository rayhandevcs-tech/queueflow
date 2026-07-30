import type { Dict } from "@/lib/i18n";

export const providerPaymentMethodsDict = {
  pageTitle: { bn: "পেমেন্ট মেথড", en: "Payment methods" },
  pageSubtitle: {
    bn: "কাস্টমারের কাছ থেকে টাকা নেওয়ার মাধ্যম বেছে নাও",
    en: "Choose how you accept payment from customers",
  },
  cashLabel: { bn: "ক্যাশ", en: "Cash" },
  cashDesc: {
    bn: "সার্ভিস শেষে হাতে হাতে টাকা নেওয়া — ডিফল্ট মেথড",
    en: "Collected in hand after service — the default method",
  },
  bkashLabel: { bn: "বিকাশ", en: "bKash" },
  nagadLabel: { bn: "নগদ", en: "Nagad" },
  rocketLabel: { bn: "রকেট", en: "Rocket" },
  cardLabel: { bn: "কার্ড", en: "Card" },
  comingSoonDesc: { bn: "সরাসরি চেকআউটে শীঘ্রই আসছে", en: "Coming soon at direct checkout" },
  comingSoonToast: {
    bn: (label: string) => `${label} — শীঘ্রই আসছে`,
    en: (label: string) => `${label} — Coming soon`,
  },
  comingSoonBadge: { bn: "শীঘ্রই আসছে", en: "Coming soon" },
} satisfies Dict;
