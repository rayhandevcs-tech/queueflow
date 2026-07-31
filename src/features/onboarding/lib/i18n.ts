import type { Dict } from "@/lib/i18n";

export const onboardingDict = {
  genderLabel: { bn: "জেন্ডার", en: "Gender" },
  male: { bn: "পুরুষ", en: "Male" },
  female: { bn: "মহিলা", en: "Female" },
  other: { bn: "অন্যান্য", en: "Other" },
  saving: { bn: "সংরক্ষণ হচ্ছে…", en: "Saving…" },
  save: { bn: "সংরক্ষণ করো", en: "Save" },
  skipping: { bn: "এগিয়ে যাওয়া হচ্ছে…", en: "Skipping…" },
  skip: { bn: "এখন না, স্কিপ করো", en: "Not now, skip" },
  saveFailed: {
    bn: "সংরক্ষণ করা যায়নি — আবার চেষ্টা করো।",
    en: "Couldn't save — try again.",
  },
  pageTitle: { bn: "প্রোফাইল সম্পূর্ণ করো", en: "Complete your profile" },
  pageSubtitle: {
    bn: "ছবি, জেন্ডার — চাইলে এখন দাও, চাইলে পরে",
    en: "Photo, gender — give them now or later",
  },
} satisfies Dict;
