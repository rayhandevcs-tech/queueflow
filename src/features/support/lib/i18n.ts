import type { Dict } from "@/lib/i18n";

export const supportDict = {
  searchPlaceholder: { bn: "প্রশ্ন খুঁজো...", en: "Search questions..." },
  all: { bn: "সব", en: "All" },
  noQuestionsTitle: { bn: "কোনো প্রশ্ন পাওয়া যায়নি", en: "No questions found" },
  noQuestionsDesc: {
    bn: "অন্য শব্দ দিয়ে খুঁজে দেখো, অথবা সরাসরি যোগাযোগ করো।",
    en: "Try different words, or reach out to us directly.",
  },
  directContact: { bn: "সরাসরি যোগাযোগ", en: "Direct contact" },
  whatsappMessage: { bn: "হোয়াটসঅ্যাপে মেসেজ দাও", en: "Message us on WhatsApp" },

  // Page titles (SharedPageShell)
  helpCenterTitle: { bn: "হেল্প সেন্টার", en: "Help center" },
  privacyPolicyTitle: { bn: "গোপনীয়তা নীতি", en: "Privacy policy" },
  privacyIntro: {
    bn: "তোমার তথ্য কীভাবে রাখা ও ব্যবহার করা হয়, তার সংক্ষিপ্ত বিবরণ।",
    en: "A short summary of how your information is kept and used.",
  },
  termsTitle: { bn: "ব্যবহারের শর্তাবলী", en: "Terms of use" },
  termsIntro: {
    bn: "এই অ্যাপ ব্যবহার করার আগে নিচের শর্তগুলো পড়ে নাও।",
    en: "Please read these terms before using the app.",
  },
  cancellationPolicyTitle: { bn: "বাতিল নীতি", en: "Cancellation policy" },
  notificationSettingsTitle: { bn: "নোটিফিকেশন সেটিংস", en: "Notification settings" },
} satisfies Dict;
