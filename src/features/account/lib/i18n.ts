import type { Dict } from "@/lib/i18n";

export const accountDict = {
  fullNameLabel: { bn: "পূর্ণ নাম", en: "Full name" },
  phoneLabel: { bn: "ফোন নম্বর", en: "Phone number" },
  genderLabel: { bn: "জেন্ডার", en: "Gender" },
  male: { bn: "পুরুষ", en: "Male" },
  female: { bn: "নারী", en: "Female" },
  other: { bn: "অন্যান্য", en: "Other" },
  dateOfBirthLabel: { bn: "জন্মতারিখ", en: "Date of birth" },
  addressLabel: { bn: "ঠিকানা", en: "Address" },
  addressHint: {
    bn: "আশেপাশের দোকানের দূরত্ব দেখাতে কাজে লাগে — লাইভ লোকেশন না দিলে এটাই ব্যবহার হয়",
    en: "Used to show distance to nearby shops when you haven't shared live location",
  },
  addressPlaceholder: { bn: "রোড, এলাকা, শহর", en: "Road, area, city" },
  useCurrentLocationCta: { bn: "কারেন্ট লোকেশন", en: "Use current location" },
  locatingLabel: { bn: "খোঁজা হচ্ছে…", en: "Locating…" },
  saving: { bn: "সংরক্ষণ হচ্ছে…", en: "Saving…" },
  saveChanges: { bn: "পরিবর্তন সংরক্ষণ করো", en: "Save changes" },
  saveFailed: { bn: "সংরক্ষণ করা যায়নি — আবার চেষ্টা করো।", en: "Couldn't save — try again." },
  saved: { bn: "সংরক্ষিত হয়েছে", en: "Saved" },

  changePassword: { bn: "পাসওয়ার্ড পরিবর্তন করো", en: "Change password" },
  currentPasswordLabel: { bn: "বর্তমান পাসওয়ার্ড", en: "Current password" },
  newPasswordLabel: { bn: "নতুন পাসওয়ার্ড", en: "New password" },
  confirmLabel: { bn: "কনফার্ম করো", en: "Confirm" },
  changingPassword: { bn: "সংরক্ষণ হচ্ছে…", en: "Saving…" },
  changePasswordCta: { bn: "পাসওয়ার্ড বদলাও", en: "Change password" },
  cancel: { bn: "বাতিল", en: "Cancel" },
  passwordChanged: { bn: "বদলানো হয়েছে", en: "Changed" },

  deleteAccountCta: { bn: "অ্যাকাউন্ট মুছে ফেলো", en: "Delete account" },
  deleteAccountTitle: { bn: "অ্যাকাউন্ট মুছে ফেলবে?", en: "Delete your account?" },
  deleteAccountDescription: {
    bn: "প্রোফাইল, মেসেজ, রিভিউ, ফেভারিট আর নোটিফিকেশন স্থায়ীভাবে মুছে যাবে — এটা ফেরানো যায় না।",
    en: "Your profile, messages, reviews, favorites, and notifications will be permanently deleted — this can't be undone.",
  },
  deleteConfirm: { bn: "মুছে ফেলো", en: "Delete" },
  keepAccount: { bn: "থাক", en: "Keep it" },
  deleteFailedGeneric: { bn: "কিছু একটা ভুল হয়েছে।", en: "Something went wrong." },

  notifAlwaysOnNote: {
    bn: "বুকিং কনফার্মেশনের নোটিফিকেশন সবসময় চালু থাকে। বাকিগুলো ইচ্ছেমতো বন্ধ রাখতে পারো।",
    en: "Booking confirmation notifications are always on. You can turn the rest off as you like.",
  },
  queueUpdateLabel: { bn: "সিরিয়াল আপডেট", en: "Queue update" },
  queueUpdateHint: { bn: "সামনে আর কয়জন আছে, তার আপডেট", en: "Updates on how many are ahead of you" },
  yourTurnLabel: { bn: "তোমার পালা এসেছে", en: "Your turn" },
  yourTurnHint: {
    bn: "এখন তোমার সার্ভিস শুরু হওয়ার নোটিফিকেশন",
    en: "Notification when your service is about to start",
  },
  cancelledLabel: { bn: "বাতিল হয়েছে", en: "Cancelled" },
  cancelledHint: { bn: "সিরিয়াল বাতিল হলে জানানো", en: "Notified if your serial is cancelled" },
  promoLabel: { bn: "অফার ও প্রোমো", en: "Offers & promos" },
  promoHint: { bn: "দোকান থেকে অফার/ঘোষণা", en: "Offers and announcements from shops" },
  reminderLabel: { bn: "রিমাইন্ডার", en: "Reminders" },
  reminderHint: { bn: "বাকি টাকা ও আবার আসার রিমাইন্ডার", en: "Due-balance and come-back reminders" },
  leaveNowLabel: { bn: "রওনা দেওয়ার সময়", en: "Time to leave" },
  leaveNowHint: {
    bn: "পালা আসার আগে, তোমার দূরত্ব হিসাব করে কখন বের হতে হবে",
    en: "When to set out, based on how far you are from the shop",
  },
  dailySummaryLabel: { bn: "দিনশেষের হিসাব", en: "End-of-day summary" },
  dailySummaryHint: {
    bn: "প্রতি রাতে আজকের কতজন, কত আয়, কখন সবচেয়ে ব্যস্ত ছিল",
    en: "Each night: how many customers, how much came in, when you were busiest",
  },
  newBookingLabel: { bn: "নতুন অনলাইন সিরিয়াল", en: "New online serial" },
  newBookingHint: {
    bn: "কেউ অনলাইনে সিরিয়াল নিলে বা বাতিল করলে সাথে সাথে জানানো",
    en: "Told the moment someone books or cancels online",
  },

  pushSectionTitle: { bn: "পুশ নোটিফিকেশন", en: "Push notifications" },
  pushSectionHint: {
    bn: "অ্যাপ বন্ধ থাকলেও তোমার ডিভাইসে নোটিফিকেশন পৌঁছাবে।",
    en: "Get notified on this device even when the app is closed.",
  },
  pushEnableCta: { bn: "চালু করো", en: "Enable" },
  pushDisableCta: { bn: "বন্ধ করো", en: "Disable" },
  pushEnabling: { bn: "চালু হচ্ছে…", en: "Enabling…" },
  pushDisabling: { bn: "বন্ধ হচ্ছে…", en: "Disabling…" },
  pushEnabledStatus: { bn: "এই ডিভাইসে চালু আছে", en: "Enabled on this device" },
  pushUnsupported: {
    bn: "এই ব্রাউজার পুশ নোটিফিকেশন সাপোর্ট করে না।",
    en: "This browser doesn't support push notifications.",
  },
  pushPermissionDenied: {
    bn: "ব্রাউজারে নোটিফিকেশন পারমিশন বন্ধ আছে — ব্রাউজার সেটিংস থেকে চালু করে আবার চেষ্টা করো।",
    en: "Notification permission is blocked — enable it in your browser settings and try again.",
  },
  pushSubscribeFailed: { bn: "চালু করা যায়নি — আবার চেষ্টা করো।", en: "Couldn't enable — try again." },

  installPromptTitle: { bn: "হোমস্ক্রিনে যোগ করো", en: "Add to Home Screen" },
  installPromptIOSHint: {
    bn: "আইফোনে ইনস্টল করতে Share বাটনে চেপে \"Add to Home Screen\" বেছে নাও।",
    en: 'On iPhone, tap the Share button and choose "Add to Home Screen".',
  },

  // Account page
  accountTitle: { bn: "অ্যাকাউন্ট ও সেটিংস", en: "Account & Settings" },
  profileLoadFailed: { bn: "তোমার প্রোফাইল লোড করা যায়নি।", en: "Couldn't load your profile." },
  noName: { bn: "নাম নেই", en: "No name" },
  customerRole: { bn: "কাস্টমার", en: "Customer" },
  providerRole: { bn: "দোকানদার", en: "Provider" },
  profileInfoSection: { bn: "প্রোফাইল", en: "Profile" },
  securitySection: { bn: "নিরাপত্তা", en: "Security" },
  preferencesSection: { bn: "প্রেফারেন্স", en: "Preferences" },
  dangerZoneSection: { bn: "ডেঞ্জার জোন", en: "Danger zone" },
  languageBn: { bn: "বাংলা", en: "বাংলা" },
  languageEn: { bn: "English", en: "English" },

  themeLabel: { bn: "থিম", en: "Theme" },
  themeHint: {
    bn: "রং বদলায়, আর কিছু না — লেখা, মাপ, সাজসজ্জা সব একই থাকে। পছন্দটা এই ডিভাইসে সেভ থাকে, তাই ফোনে আর দোকানের ট্যাবে আলাদা থিম রাখা যায়।",
    en: "Only the colours change — type, spacing and layout stay exactly as they are. The choice is saved on this device, so your phone and the shop tablet can each have their own.",
  },

  // The customer's preferred experience, changeable after signup. The hint
  // repeats the "not a restriction" point, because Settings is where someone
  // goes when they are worried they picked wrong.
  experienceLabel: { bn: "ডিফল্ট অভিজ্ঞতা", en: "Default experience" },
  experienceHint: {
    bn: "অ্যাপ খুললে প্রথমে কী দেখবে। দুই ধরনের দোকানই সবসময় খুঁজতে ও বুক করতে পারবে — এটা শুধু শুরুর পর্দা ঠিক করে।",
    en: "What you see first when you open the app. You can always find and book both kinds of shop — this only sets the starting screen.",
  },
  experienceSalon: { bn: "সেলুন", en: "Salon" },
  experienceParlour: { bn: "বিউটি পার্লার", en: "Beauty parlour" },
  experienceUnset: {
    bn: "এখনো বাছাই করা হয়নি — আপাতত সেলুনের সিরিয়াল দিয়ে শুরু হচ্ছে।",
    en: "Not chosen yet — starting on the salon queue for now.",
  },
  experienceSaveFailed: {
    bn: "পছন্দটা সেভ করা যায়নি। আবার চেষ্টা করো।",
    en: "Could not save that preference. Try again.",
  },
  notificationSettings: { bn: "নোটিফিকেশন সেটিংস", en: "Notification settings" },
  helpCenter: { bn: "হেল্প সেন্টার", en: "Help center" },
  privacyPolicy: { bn: "গোপনীয়তা নীতি", en: "Privacy policy" },
  termsOfUse: { bn: "ব্যবহারের শর্তাবলী", en: "Terms of use" },
  cancellationPolicy: { bn: "বাতিল নীতি", en: "Cancellation policy" },
  logout: { bn: "লগ-আউট", en: "Log out" },
  logoutConfirmTitle: { bn: "লগ-আউট করবে?", en: "Log out?" },
  logoutConfirmDescription: {
    bn: "আবার লগইন করতে তোমার ইমেইল ও পাসওয়ার্ড লাগবে।",
    en: "You'll need your email and password to log back in.",
  },
  logoutConfirmCta: { bn: "লগ-আউট করো", en: "Log out" },
  stay: { bn: "থাক", en: "Stay" },
  notLoggedIn: { bn: "লগইন করা নেই", en: "Not logged in" },
} satisfies Dict;
