import type { Dict } from "@/lib/i18n";

export const providerAnalyticsDict = {
  peakBadge: { bn: "পিক", en: "Peak" },
  customerAnalyticsTitle: { bn: "কাস্টমার অ্যানালিটিক্স", en: "Customer analytics" },
  analyticsSubtitle: {
    bn: "কখন কেমন চাপ থাকে বুঝে নাও — কর্মী ও সময় পরিকল্পনা করো",
    en: "See when it gets busy — plan your staff and hours around it",
  },
  dailyAvgCustomers: { bn: "দৈনিক গড় কাস্টমার", en: "Daily avg. customers" },
  peakTime: { bn: "পিক টাইম", en: "Peak time" },
  beforeMorning8: { bn: "সকাল ৮টার আগে", en: "Before 8am" },
  noneYet: { bn: "এখনো নেই", en: "None yet" },
  avgServiceTime: { bn: "গড় সার্ভিস সময়", en: "Avg. service time" },
  minShort: { bn: "মি", en: "m" },
  notEnoughData: {
    bn: "এখনো যথেষ্ট কাজ সম্পন্ন হয়নি — কাজ চলতে থাকলে এখানে সময়ভিত্তিক চাপ আর ইনসাইট দেখা যাবে।",
    en: "Not enough jobs completed yet — keep going and time-based load and insights will show up here.",
  },
  loadByTime: { bn: "সময় অনুযায়ী কাস্টমার চাপ (গত ৯০ দিন)", en: "Customer load by time (last 90 days)" },
  weeklyLoad: { bn: "সাপ্তাহিক চাপ", en: "Weekly load" },
  insights: { bn: "ইনসাইট", en: "Insights" },
  noInsightsYet: { bn: "এখনো ইনসাইট তৈরি করার মতো ডেটা নেই।", en: "Not enough data for insights yet." },
} satisfies Dict;
