import type { Dict } from "@/lib/i18n";

export const providerDueLedgerDict = {
  dueLedgerTitle: { bn: "বাকির খাতা", en: "Due ledger" },
  noOneOwes: { bn: "এখন কারো কাছে কোনো বাকি নেই", en: "No one owes anything right now" },
  totalDueSummary: {
    bn: (amount: string, n: number) => `মোট বাকি ৳${amount} · ${n} জন কাস্টমার`,
    en: (amount: string, n: number) => `Total due ৳${amount} · ${n} customers`,
  },
  emptyLedgerTitle: { bn: "বাকির খাতা খালি", en: "Ledger is empty" },
  emptyLedgerDesc: {
    bn: '"বাকি রেখে সম্পন্ন করো" দিয়ে কাজ শেষ করলে সেই কাস্টমার এখানে দেখাবে।',
    en: 'Customers who finish with "Complete, leave due" show up here.',
  },
  dueSince: {
    bn: (date: string) => `সেই থেকে বাকি ${date}`,
    en: (date: string) => `Due since ${date}`,
  },
  timesSuffix: { bn: (n: number) => `${n} বার`, en: (n: number) => `${n}×` },
  alreadyRemindedToday: { bn: "আজ পাঠানো হয়ে গেছে", en: "Already sent today" },
  sendReminderTitle: { bn: "রিমাইন্ডার দাও", en: "Send a reminder" },
  reminderSent: { bn: "🔔 রিমাইন্ডার পাঠানো হয়েছে", en: "🔔 Reminder sent" },
  reminderFailedGeneric: {
    bn: "রিমাইন্ডার পাঠানো যায়নি — আবার চেষ্টা করো",
    en: "Couldn't send the reminder — try again",
  },
  markCollected: { bn: "আদায় হয়েছে", en: "Collected" },
  markedCollected: { bn: "✓ আদায় হয়েছে হিসেবে মার্ক করা হয়েছে", en: "✓ Marked as collected" },
  markFailed: { bn: "মার্ক করা যায়নি — আবার চেষ্টা করো", en: "Couldn't mark — try again" },
} satisfies Dict;
