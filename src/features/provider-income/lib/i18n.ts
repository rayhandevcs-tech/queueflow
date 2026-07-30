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
} satisfies Dict;
