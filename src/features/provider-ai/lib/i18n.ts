import type { Dict } from "@/lib/i18n";

export const providerAiDict = {
  pageTitle: { bn: "AI সহকারী", en: "AI assistant" },
  pageSubtitle: {
    bn: "তোমার নিজের হিসাব দেখে বিশ্লেষণ — কী ভালো চলছে, কোথায় টাকা হারাচ্ছ।",
    en: "An analysis of your own numbers — what's working, and where money is leaking.",
  },

  // Analysis card
  analyseCta: { bn: "বিশ্লেষণ করো", en: "Analyse" },
  analyseAgainCta: { bn: "আবার বিশ্লেষণ করো", en: "Analyse again" },
  analysing: { bn: "হিসাব দেখছি…", en: "Reading your numbers…" },
  analysingHint: {
    bn: "১৫-২০ সেকেন্ড লাগতে পারে।",
    en: "This can take 15-20 seconds.",
  },
  idleTitle: { bn: "এখনো বিশ্লেষণ করা হয়নি", en: "No analysis yet" },
  idleBody: {
    bn: "গত ছয় মাসের সিরিয়াল, খরচ আর রিভিউ দেখে বিশ্লেষণ তৈরি হবে।",
    en: "Built from the last six months of serials, expenses and reviews.",
  },
  generatedAt: {
    bn: (when: string) => `${when}-এর হিসাব অনুযায়ী`,
    en: (when: string) => `Based on figures as of ${when}`,
  },
  actionsTitle: { bn: "এই সপ্তাহে যা করতে পারো", en: "What to do this week" },

  // Chat
  chatTitle: { bn: "প্রশ্ন করো", en: "Ask a question" },
  chatPlaceholder: { bn: "যেমন — এই মাসে আয় কত?", en: "e.g. how much did I earn this month?" },
  chatSend: { bn: "পাঠাও", en: "Send" },
  chatEmpty: {
    bn: "তোমার দোকানের হিসাব নিয়ে যা খুশি জিজ্ঞেস করো।",
    en: "Ask anything about your shop's numbers.",
  },
  suggestion1: { bn: "এই মাসে আয় কত?", en: "How much did I earn this month?" },
  suggestion2: { bn: "কোন সার্ভিস সবচেয়ে বেশি চলে?", en: "Which service sells most?" },
  suggestion3: { bn: "সবচেয়ে ব্যস্ত সময় কখন?", en: "When am I busiest?" },
  suggestion4: { bn: "বাকি কত জমে আছে?", en: "How much is outstanding?" },

  // Errors
  errNoData: {
    bn: "বিশ্লেষণ করার মতো যথেষ্ট হিসাব এখনো জমেনি। কয়েকটা সিরিয়াল সম্পন্ন হলে আবার দেখো।",
    en: "There isn't enough history to analyse yet. Come back after a few completed jobs.",
  },
  errNoKey: {
    bn: "AI এখনো চালু করা হয়নি — সার্ভারে ANTHROPIC_API_KEY বসানো বাকি।",
    en: "AI isn't switched on yet — the server is missing ANTHROPIC_API_KEY.",
  },
  errGeneric: {
    bn: "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করো।",
    en: "Something went wrong. Try again.",
  },
  retryCta: { bn: "আবার চেষ্টা করো", en: "Try again" },

  // Floating widget
  botName: { bn: "সহায়ক", en: "Assistant" },
  botSubtitle: { bn: "তোমার দোকানের হিসাব জানে", en: "Knows your shop's numbers" },
  openLabel: { bn: "সহায়ক খোলো", en: "Open the assistant" },
  closeLabel: { bn: "বন্ধ করো", en: "Close" },
  greeting: {
    bn: "দোকানের হিসাব নিয়ে যা জানার আছে জিজ্ঞেস করো।",
    en: "Ask me anything about your shop's numbers.",
  },
  stopLabel: { bn: "থামাও", en: "Stop" },
  botFootnote: {
    bn: "এটা AI — কাস্টমারের মেসেজ নয়।",
    en: "This is AI — not a customer message.",
  },
  errSignedOut: { bn: "আগে লগইন করো।", en: "Please sign in first." },

  // Honesty
  aiCaveat: {
    bn: "AI ভুল করতে পারে — বড় সিদ্ধান্তের আগে নিজের হিসাব মিলিয়ে নিও।",
    en: "AI can be wrong — check the figures yourself before any big decision.",
  },
} satisfies Dict;
