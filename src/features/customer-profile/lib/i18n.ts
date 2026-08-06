import type { Dict } from "@/lib/i18n";

export const customerProfileDict = {
  // ProfileView
  myProfileTitle: { bn: "আমার প্রোফাইল", en: "My profile" },
  customerFallback: { bn: "কাস্টমার", en: "Customer" },
  trustScoreLabel: { bn: "ট্রাস্ট স্কোর", en: "Trust score" },
  newCustomerCallout: {
    bn: "নতুন কাস্টমার। সিরিয়াল দিয়ে সার্ভিস নিতে থাকলে তোমার ট্রাস্ট স্কোর তৈরি হবে।",
    en: "New customer. Your trust score builds as you keep booking serials.",
  },
  trustedCustomerCallout: {
    bn: "বিশ্বস্ত কাস্টমার। তুমি সিরিয়াল দিয়ে সার্ভিস নাও — তাই দোকানদাররা তোমার সিরিয়াল অগ্রাধিকার দেয়।",
    en: "Trusted customer. You show up for your serials — so shop owners prioritize you.",
  },
  someAbsencesCallout: {
    bn: "কিছু সিরিয়ালে অনুপস্থিত ছিলে। নিয়মিত সিরিয়াল রাখলে ট্রাস্ট স্কোর আবার বাড়বে।",
    en: "You missed a few serials. Keeping your serials regularly will grow your trust score again.",
  },
  totalVisits: { bn: "মোট ভিজিট", en: "Total visits" },
  noShows: { bn: "নো-শো", en: "No-shows" },
  regularShops: { bn: "নিয়মিত দোকান", en: "Regular shops" },
  spendingHeading: { bn: "খরচের হিসাব", en: "Spending" },
  seeAllTransactions: { bn: "সব লেনদেন দেখো", en: "See all transactions" },
  spentThisMonth: { bn: "এই মাসে খরচ", en: "Spent this month" },
  noSpendLastMonth: { bn: "গত মাসে কোনো খরচ ছিল না", en: "No spending last month" },
  moreThanLastMonth: {
    bn: (pct: number) => `▲ গত মাসের চেয়ে ${pct}%`,
    en: (pct: number) => `▲ ${pct}% more than last month`,
  },
  lessThanLastMonth: {
    bn: (pct: number) => `▼ গত মাসের চেয়ে ${pct}%`,
    en: (pct: number) => `▼ ${pct}% less than last month`,
  },
  totalSpend: { bn: "সর্বমোট খরচ", en: "Total spend" },
  visitsCountSuffix: { bn: (n: number) => `${n} টি ভিজিট`, en: (n: number) => `${n} visits` },
  last12MonthsSpend: { bn: "গত ১২ মাসের খরচ", en: "Last 12 months' spend" },
  inThousands: { bn: "৳ হাজারে", en: "৳ in thousands" },
  spendByShop: { bn: "দোকান অনুযায়ী খরচ", en: "Spend by shop" },
  shopFallback: { bn: "দোকান", en: "Shop" },
  visitsSuffixShort: { bn: (n: number) => `${n} বার`, en: (n: number) => `${n}×` },
  favoriteShopsHeading: { bn: "প্রিয় দোকান", en: "Favorite shops" },
  seeAllBookings: { bn: "সব বুকিং দেখো", en: "See all bookings" },
  noFavoritesYet: {
    bn: "এখনো কোনো দোকান প্রিয় তালিকায় নেই — শপ ডিটেইলে ♥ বাটনে ট্যাপ করো।",
    en: "No favorite shops yet — tap the ♥ button on a shop's page.",
  },

  // ReviewDialog
  ratingWorst: { bn: "খুব খারাপ", en: "Very bad" },
  ratingBad: { bn: "খারাপ", en: "Bad" },
  ratingOkay: { bn: "মোটামুটি", en: "Okay" },
  ratingGood: { bn: "ভালো", en: "Good" },
  ratingGreat: { bn: "চমৎকার!", en: "Great!" },
  reviewThanks: { bn: "🙏 রিভিউয়ের জন্য ধন্যবাদ!", en: "🙏 Thanks for the review!" },
  reviewSubmitFailed: {
    bn: "রিভিউ দেওয়া যায়নি — আবার চেষ্টা করো।",
    en: "Couldn't submit the review — try again.",
  },
  imageUploadFailed: { bn: "ছবি আপলোড ব্যর্থ হয়েছে", en: "Image upload failed" },
  howWasShop: { bn: (name: string) => `${name} কেমন ছিল?`, en: (name: string) => `How was ${name}?` },
  reviewBoostsAuthenticity: {
    bn: "তোমার রিভিউ দোকানের অথেন্টিসিটি বাড়াবে",
    en: "Your review helps build trust for this shop",
  },
  commentPlaceholder: { bn: "অভিজ্ঞতা লিখো (ঐচ্ছিক)…", en: "Share your experience (optional)…" },
  submitting: { bn: "পাঠানো হচ্ছে…", en: "Submitting…" },
  submitReview: { bn: "রিভিউ সাবমিট করো", en: "Submit review" },

  // EReceiptSheet
  totalLabel: { bn: "মোট", en: "Total" },
  receiptCodeAlt: { bn: (code: string) => `রিসিট কোড ${code}`, en: (code: string) => `Receipt code ${code}` },
  download: { bn: "ডাউনলোড", en: "Download" },

  // CancelledBookingsList
  noCancelledTitle: { bn: "বাতিল হওয়া কোনো সিরিয়াল নেই", en: "No cancelled serials" },
  noCancelledDesc: {
    bn: "বাতিল বা মিস হওয়া সিরিয়াল এখানে দেখতে পাবে।",
    en: "Cancelled or missed serials will show up here.",
  },
  bookAgain: { bn: "আবার বুক করুন", en: "Book again" },

  // CompletedBookingsList
  noCompletedTitle: { bn: "এখনো কোনো সিরিয়াল সম্পন্ন হয়নি", en: "No completed serials yet" },
  noCompletedDesc: {
    bn: "সার্ভিস সম্পন্ন হলে এখানে রিসিটসহ দেখতে পাবে।",
    en: "Completed services will show up here with a receipt.",
  },
  codeLabel: { bn: (code: string) => `কোড ${code}`, en: (code: string) => `Code ${code}` },
  giveReview: { bn: "রিভিউ দাও", en: "Rate it" },

  // TransactionsView
  transactionsTitle: { bn: "লেনদেন", en: "Transactions" },
  noTransactionsTitle: { bn: "এখনো কোনো লেনদেন নেই", en: "No transactions yet" },
  noTransactionsDesc: {
    bn: "সার্ভিস সম্পন্ন হলে এখানে খরচের হিসাব দেখতে পাবে।",
    en: "Your spending will show up here once services are completed.",
  },
  dueAmount: { bn: (amount: string) => `বাকি ৳${amount}`, en: (amount: string) => `Due ৳${amount}` },

  // my-serial/page
  ongoingTab: { bn: "চলমান", en: "Ongoing" },
  completedTab: { bn: "সম্পন্ন", en: "Completed" },
  cancelledTab: { bn: "বাতিল", en: "Cancelled" },
  myBookingsTitle: { bn: "আমার বুকিং", en: "My bookings" },

  // review-storage.api / review.api
  onlyImagesAllowed: { bn: "শুধু ছবি আপলোড করা যাবে", en: "Only images can be uploaded" },
  imageTooLarge: { bn: "ছবি ২ এমবি-র নিচে হতে হবে", en: "Image must be under 2 MB" },
  uploadFailedRetry: {
    bn: "আপলোড ব্যর্থ হয়েছে — আবার চেষ্টা করো",
    en: "Upload failed — try again",
  },
  notLoggedIn: { bn: "লগইন করা নেই", en: "Not logged in" },

  // Habits + self-reminder (Sprint 32)
  habitsHeading: { bn: "তোমার অভ্যাস", en: "Your habits" },
  habitCadenceLabel: { bn: "সাধারণত যাও", en: "You usually go" },
  habitLastVisitLabel: { bn: "শেষ গিয়েছিলে", en: "Last visit" },
  habitEveryDays: {
    bn: (n: number) => `প্রতি ${n} দিনে`,
    en: (n: number) => `every ${n} days`,
  },
  habitDaysAgo: {
    bn: (n: number) => (n === 0 ? "আজই" : `${n} দিন আগে`),
    en: (n: number) => (n === 0 ? "today" : `${n} days ago`),
  },
  habitUnknown: { bn: "—", en: "—" },
  habitFavouriteShop: {
    bn: (shop: string, visits: number) => `সবচেয়ে বেশি যাও ${shop}-এ · মোট ${visits} বার`,
    en: (shop: string, visits: number) => `Most visits at ${shop} · ${visits} in total`,
  },
  reminderPrompt: { bn: "মনে করিয়ে দেবো?", en: "Want a reminder?" },
  everyWeeks: {
    bn: (n: number) => `${n} সপ্তাহ`,
    en: (n: number) => `${n} weeks`,
  },
  reminderSetCta: { bn: "সেট করো", en: "Set it" },
  reminderActive: {
    bn: (n: number) => `প্রতি ${n} সপ্তাহে মনে করিয়ে দেবো`,
    en: (n: number) => `We'll remind you every ${n} weeks`,
  },
  reminderStopCta: { bn: "বন্ধ করো", en: "Turn off" },
  reminderSavedToast: {
    bn: (n: number) => `প্রতি ${n} সপ্তাহে মনে করিয়ে দেবো`,
    en: (n: number) => `Reminder set for every ${n} weeks`,
  },
  reminderRemovedToast: { bn: "রিমাইন্ডার বন্ধ হয়েছে", en: "Reminder turned off" },
  reminderFailedToast: { bn: "সেট করা যায়নি — আবার চেষ্টা করো।", en: "Couldn't set it — try again." },
  bookAgainShort: { bn: "আবার", en: "Again" },

  // Favourite wait alerts
  waitAlertHeading: { bn: "কখন খবর দেবো", en: "When to ping you" },
  waitAlertHint: {
    bn: "প্রিয় দোকানের অপেক্ষা এর নিচে নামলে জানিয়ে দেবো — দিনে সর্বোচ্চ একবার।",
    en: "We'll tell you when a favourite's wait drops below this — at most once a day.",
  },
  waitAlertOff: { bn: "বন্ধ", en: "Off" },
  waitAlertUnder: {
    bn: (n: number) => `${n} মিনিটের কম`,
    en: (n: number) => `under ${n} min`,
  },
  waitAlertSetToast: {
    bn: (n: number) => `${n} মিনিটের কম হলে জানিয়ে দেবো`,
    en: (n: number) => `We'll ping you under ${n} min`,
  },
} satisfies Dict;