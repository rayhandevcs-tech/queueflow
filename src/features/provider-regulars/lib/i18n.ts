import type { Dict } from "@/lib/i18n";

export const providerRegularsDict = {
  regularCustomersTitle: { bn: "নিয়মিত কাস্টমার", en: "Regular customers" },
  regularsSubtitle: {
    bn: "এই মাসে যারা আসেনি তাদের রিমাইন্ডার পাঠাও",
    en: "Send a reminder to those who haven't visited this month",
  },
  noRegularsTitle: { bn: "এখনো কোনো নিয়মিত কাস্টমার নেই", en: "No regular customers yet" },
  noRegularsDesc: {
    bn: "একজন কাস্টমার অন্তত দুইবার সার্ভিস নিলে সে এখানে দেখাবে।",
    en: "Customers who've booked at least twice show up here.",
  },
  lastVisitedSummary: {
    bn: (date: string, n: number) => `শেষ এসেছিল ${date} · মোট ${n} বার`,
    en: (date: string, n: number) => `Last visited ${date} · ${n} visits total`,
  },
  visitedThisMonth: { bn: "এই মাসে এসেছে", en: "Visited this month" },
  notVisited: { bn: "আসেনি", en: "Hasn't visited" },
  noWayToReach: {
    bn: "এই কাস্টমারের কোনো অ্যাকাউন্ট বা ফোন নম্বর নেই — যোগাযোগ করা যাচ্ছে না",
    en: "No account or phone number on file for this customer — can't reach them",
  },
  sendMessage: { bn: "মেসেজ পাঠাও", en: "Send message" },
  alreadySent: { bn: "✓ পাঠানো হয়েছে", en: "✓ Sent" },
  reminderSent: { bn: "🔔 রিমাইন্ডার পাঠানো হয়েছে", en: "🔔 Reminder sent" },
  reminderNotReady: {
    bn: "রিমাইন্ডার ফিচার এখনো চালু হয়নি — মাইগ্রেশন বাকি আছে",
    en: "Reminder feature isn't live yet — migration pending",
  },
  sendReminder: { bn: "রিমাইন্ডার দাও", en: "Send reminder" },
  customerFallback: { bn: "কাস্টমার", en: "Customer" },
} satisfies Dict;
