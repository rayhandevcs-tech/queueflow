import type { Dict } from "@/lib/i18n";

export const providerIncomeDict = {
  incomeTrackingTitle: { bn: "ইনকাম ট্র্যাকিং", en: "Income tracking" },
  incomeSubtitle: {
    bn: "প্রতিটি কাজের আয় অটো যোগ হয় — “কাজ সম্পন্ন” চাপলেই",
    en: "Every job's income is added automatically when you tap “Job done”",
  },
  today: { bn: "আজ", en: "Today" },
  jobsCountSuffix: { bn: (n: number) => `${n} টি কাজ`, en: (n: number) => `${n} jobs` },
  thisMonth: {
    bn: (monthName: string) => `এই মাস (${monthName})`,
    en: (monthName: string) => `This month (${monthName})`,
  },
  noIncomeLastMonth: { bn: "গত মাসে কোনো আয় ছিল না", en: "No income last month" },
  moreThanLastMonth: {
    bn: (pct: number) => `▲ গত মাসের চেয়ে ${pct}%`,
    en: (pct: number) => `▲ ${pct}% more than last month`,
  },
  lessThanLastMonth: {
    bn: (pct: number) => `▼ গত মাসের চেয়ে ${pct}%`,
    en: (pct: number) => `▼ ${pct}% less than last month`,
  },
  thisYear: { bn: (year: string) => `এই বছর (${year})`, en: (year: string) => `This year (${year})` },
  last12MonthsIncome: { bn: "গত ১২ মাসের আয়", en: "Last 12 months' income" },
  inThousands: { bn: "৳ হাজারে", en: "৳ in thousands" },
  incomeByService: { bn: "সার্ভিস অনুযায়ী আয় (এই মাস)", en: "Income by service (this month)" },
  noServicesDoneThisMonth: {
    bn: "এই মাসে এখনো কোনো সার্ভিস সম্পন্ন হয়নি।",
    en: "No services completed this month yet.",
  },
  cashDueBreakdown: {
    bn: (cash: string, due: string) => `ক্যাশ ৳${cash} · বাকি ৳${due}`,
    en: (cash: string, due: string) => `Cash ৳${cash} · Due ৳${due}`,
  },
  incomeByStaff: { bn: "স্টাফ-ভিত্তিক আয় (এই মাস)", en: "Income by staff (this month)" },
  noStaffIncomeThisMonth: {
    bn: "এই মাসে কোনো স্টাফের নামে আয় নেই।",
    en: "No staff has income this month yet.",
  },

  manualEntrySectionTitle: { bn: "ম্যানুয়াল কাজের এন্ট্রি", en: "Manual work entries" },
  manualEntrySectionSubtitle: {
    bn: "সিরিয়াল ছাড়া করা কাজের হিসাব যোগ করো",
    en: "Add income for work done without a serial",
  },
  manualEntryAddCta: { bn: "নতুন এন্ট্রি", en: "New entry" },
  manualEntryServiceLabel: { bn: "সার্ভিস", en: "Service" },
  manualEntryNoServices: { bn: "কোনো সার্ভিস নেই", en: "No services yet" },
  manualEntryInactiveSuffix: { bn: "নিষ্ক্রিয়", en: "inactive" },
  manualEntryAmountLabel: { bn: "টাকার পরিমাণ", en: "Amount" },
  manualEntryStaffLabel: { bn: "স্টাফ (ঐচ্ছিক)", en: "Staff (optional)" },
  manualEntryNoStaff: { bn: "নির্বাচন করা হয়নি", en: "Not selected" },
  manualEntryPaymentLabel: { bn: "পেমেন্ট", en: "Payment" },
  manualEntryCashOption: { bn: "ক্যাশ", en: "Cash" },
  manualEntryDueOption: { bn: "বাকি", en: "Due" },
  manualEntryNoteLabel: { bn: "নোট (ঐচ্ছিক)", en: "Note (optional)" },
  manualEntryNotePlaceholder: { bn: "যেমন — বাসায় গিয়ে কাজ", en: "e.g. — home visit" },
  manualEntrySaving: { bn: "সেভ হচ্ছে…", en: "Saving…" },
  manualEntryAdd: { bn: "যোগ করো", en: "Add" },
  manualEntryUpdate: { bn: "আপডেট করো", en: "Update" },
  manualEntryCancel: { bn: "বাতিল", en: "Cancel" },
  manualEntryUnknownService: { bn: "অজানা", en: "Unknown" },
  manualEntryEmptyTitle: { bn: "এখনো কোনো ম্যানুয়াল এন্ট্রি নেই", en: "No manual entries yet" },
  manualEntryEmptyDesc: {
    bn: "সিরিয়াল ছাড়া কাজ করলে এখানে যোগ করো।",
    en: "Add work done without a serial here.",
  },
  manualEntryEditAria: { bn: "এন্ট্রি এডিট করো", en: "Edit entry" },
  manualEntryDeleteAria: { bn: "এন্ট্রি মুছে ফেলো", en: "Delete entry" },
  manualEntryDeleteTitle: { bn: "এন্ট্রি মুছে ফেলবে?", en: "Delete this entry?" },
  manualEntryDeleteDesc: {
    bn: "এই ম্যানুয়াল এন্ট্রি মুছে ফেললে ইনকাম হিসাব থেকেও বাদ যাবে।",
    en: "Deleting this manual entry also removes it from your income totals.",
  },
  manualEntryDeleteConfirm: { bn: "মুছে ফেলো", en: "Delete" },
} satisfies Dict;
