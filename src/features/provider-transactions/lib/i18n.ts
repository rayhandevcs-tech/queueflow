import type { Dict } from "@/lib/i18n";

export const providerTransactionsDict = {
  pageTitle: { bn: "লেনদেন", en: "Transactions" },
  pageSubtitle: {
    bn: "কার কাছ থেকে কত এলো, আর কোথায় কত গেল — সব এক জায়গায়।",
    en: "Everything that came in and everything that went out, in one place.",
  },

  // Summary
  inflowLabel: { bn: "আদায় হয়েছে", en: "Collected" },
  outflowLabel: { bn: "খরচ", en: "Spent" },
  pendingLabel: { bn: "বাকি", en: "Outstanding" },
  netLabel: { bn: "নিট", en: "Net" },

  // Filters
  filterAll: { bn: "সব", en: "All" },
  filterIn: { bn: "আয়", en: "Income" },
  filterOut: { bn: "খরচ", en: "Expenses" },

  // Rows
  walkInCustomer: { bn: "অফ-লাইন কাস্টমার", en: "Walk-in customer" },
  manualEntry: { bn: "ম্যানুয়াল এন্ট্রি", en: "Manual entry" },
  unpaidTag: { bn: "বাকি", en: "Unpaid" },

  categoryRENT: { bn: "দোকান ভাড়া", en: "Rent" },
  categoryUTILITY: { bn: "কারেন্ট/পানি বিল", en: "Utilities" },
  categorySUPPLIES: { bn: "মালামাল", en: "Supplies" },
  categorySTAFF: { bn: "স্টাফ বিল", en: "Staff pay" },
  categoryOTHER: { bn: "অন্যান্য খরচ", en: "Other" },

  methodcash: { bn: "ক্যাশ", en: "Cash" },
  methodbkash: { bn: "বিকাশ", en: "bKash" },
  methodnagad: { bn: "নগদ", en: "Nagad" },
  methodrocket: { bn: "রকেট", en: "Rocket" },
  methodcard: { bn: "কার্ড", en: "Card" },

  // States
  emptyTitle: { bn: "এখনো কোনো লেনদেন নেই", en: "No transactions yet" },
  emptyBody: {
    bn: "কাজ সম্পন্ন করলে বা খরচ যোগ করলে সেটা এখানে দেখা যাবে।",
    en: "Completed jobs and recorded expenses will appear here.",
  },
  addExpenseCta: { bn: "খরচ যোগ করো", en: "Add an expense" },
  todayLabel: { bn: "আজ", en: "Today" },
  yesterdayLabel: { bn: "গতকাল", en: "Yesterday" },
} satisfies Dict;
