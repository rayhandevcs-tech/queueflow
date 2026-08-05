import type { Dict } from "@/lib/i18n";

export const customerBookingDict = {
  // StaffTab
  noStaffTitle: { bn: "কোনো স্টাফ তথ্য নেই", en: "No staff info" },
  noStaffDesc: {
    bn: "এই দোকান এখনো স্টাফ/চেয়ারের তথ্য যোগ করেনি।",
    en: "This shop hasn't added staff/chair info yet.",
  },

  // ReviewsTab
  noReviewsTitle: { bn: "এখনো কোনো রিভিউ আসেনি", en: "No reviews yet" },
  noReviewsDesc: {
    bn: "কাস্টমাররা সিরিয়াল শেষে রিভিউ দিলে এখানে দেখাবে।",
    en: "Customer reviews will show up here after they're submitted.",
  },
  reviewCountSuffix: { bn: (n: number) => `${n} রিভিউ`, en: (n: number) => `${n} reviews` },
  latestFilter: { bn: "সর্বশেষ", en: "Latest" },
  withImagesFilter: { bn: "ছবিসহ", en: "With photos" },
  noImageReviewsTitle: { bn: "ছবিসহ কোনো রিভিউ নেই", en: "No reviews with photos" },
  noImageReviewsDesc: {
    bn: "এখনো কেউ ছবি সহ রিভিউ দেয়নি।",
    en: "No one has left a review with photos yet.",
  },
  customerFallback: { bn: "কাস্টমার", en: "Customer" },
  verifiedTitle: {
    bn: "সার্ভিস নেওয়া কাস্টমারের যাচাইকৃত রিভিউ",
    en: "Verified review from a customer who used the service",
  },
  verifiedBadge: { bn: "যাচাইকৃত", en: "Verified" },

  // ShopDetailView tabs + booking flow
  tabServices: { bn: "সার্ভিস", en: "Services" },
  tabStaff: { bn: "স্টাফ", en: "Staff" },
  tabGallery: { bn: "গ্যালারি", en: "Gallery" },
  tabReviews: { bn: "রিভিউ", en: "Reviews" },
  tabDetails: { bn: "বিস্তারিত", en: "Details" },
  shopNotFound: { bn: "দোকান খুঁজে পাওয়া যায়নি।", en: "Shop not found." },
  alreadyBookedSameShop: {
    bn: "তোমার এই দোকানে ইতিমধ্যে একটা সিরিয়াল আছে।",
    en: "You already have a serial at this shop.",
  },
  alreadyBookedOtherShop: {
    bn: "তোমার ইতিমধ্যে একটা সক্রিয় সিরিয়াল আছে — একসাথে একটাই রাখা যায়।",
    en: "You already have an active serial — you can only hold one at a time.",
  },
  viewMySerial: { bn: "আমার সিরিয়াল দেখো", en: "View my serial" },
  messageShop: { bn: "দোকানে মেসেজ করো", en: "Message the shop" },
  nowSerialLabel: { bn: "এখন সিরিয়াল", en: "Now serving" },
  estWaitLabel: { bn: "আনুমানিক ওয়েট", en: "Est. wait" },
  minShort: { bn: "মি", en: "m" },
  servicesCountLabel: { bn: "সার্ভিস", en: "Services" },
  shopClosedNotice: {
    bn: "দোকান এখন বন্ধ — এই মুহূর্তে বুকিং করা যাচ্ছে না",
    en: "Shop is currently closed — booking isn't possible right now",
  },
  bookingFailedGeneric: {
    bn: "বুক করা যায়নি — আবার চেষ্টা করো।",
    en: "Couldn't book — try again.",
  },
  totalMinutesLabel: {
    bn: (n: number) => `মোট · ${n} মিনিট`,
    en: (n: number) => `Total · ${n} min`,
  },
  booking: { bn: "বুক হচ্ছে…", en: "Booking…" },
  confirmWithAdvance: { bn: "অ্যাডভান্স দিয়ে কনফার্ম", en: "Confirm with advance" },
  takeSerial: { bn: "সিরিয়াল নাও", en: "Take a serial" },
  advancePaidToast: { bn: "✅ অ্যাডভান্স পেইড — সিরিয়াল লক হলো", en: "✅ Advance paid — serial locked" },
  confirmedToast: { bn: "✅ সিরিয়াল কনফার্ম হলো", en: "✅ Serial confirmed" },

  // ServicesTab
  chooseServicesLabel: { bn: "সার্ভিস বেছে নাও", en: "Choose services" },
  noServicesAtShop: {
    bn: "এই দোকানে এখনো কোনো সার্ভিস যোগ করা হয়নি।",
    en: "This shop hasn't added any services yet.",
  },
  minutesSuffix: { bn: (n: number) => `~${n} মিনিট`, en: (n: number) => `~${n} min` },
  preferredStaffLabel: { bn: "পছন্দের স্টাফ", en: "Preferred staff" },
  autoBestMatch: { bn: "অটো (সেরা মিল)", en: "Auto (best match)" },
  advanceLockLabel: {
    bn: "অ্যাডভান্স পেমেন্ট দিয়ে সিরিয়াল লক করো",
    en: "Lock your serial with an advance payment",
  },
  advanceLockHint: {
    bn: "bKash/Nagad — সিরিয়াল কনফার্ম ও সিকিউর থাকবে",
    en: "bKash/Nagad — your serial stays confirmed and secure",
  },

  // ShopQuickActions
  call: { bn: "কল", en: "Call" },
  message: { bn: "মেসেজ", en: "Message" },
  direction: { bn: "ডিরেকশন", en: "Directions" },
  share: { bn: "শেয়ার", en: "Share" },
  linkCopied: { bn: "লিংক কপি হয়েছে", en: "Link copied" },
  linkCopyFailed: { bn: "লিংক কপি করা যায়নি", en: "Couldn't copy the link" },

  // ActiveBookingBanner
  nowInProgress: { bn: "এখন চলছে", en: "In progress now" },
  minutesUnit: { bn: (n: string | number) => `${n} মিনিট`, en: (n: string | number) => `${n} min` },
  yourSerialRunning: {
    bn: (shopName: string) => `তোমার সিরিয়াল চলছে · ${shopName}`,
    en: (shopName: string) => `Your serial is active · ${shopName}`,
  },
  serialEta: {
    bn: (position: number, wait: string) => `সিরিয়াল #${position} · আনুমানিক ${wait}`,
    en: (position: number, wait: string) => `Serial #${position} · Est. ${wait}`,
  },

  // AdvancePaymentDialog
  bkashLabel: { bn: "বিকাশ", en: "bKash" },
  nagadLabel: { bn: "নগদ", en: "Nagad" },
  advancePaymentTitle: { bn: "অ্যাডভান্স পেমেন্ট", en: "Advance payment" },
  totalChooseMethod: {
    bn: (amount: string) => `মোট ৳${amount} — মেথড বেছে নাও`,
    en: (amount: string) => `Total ৳${amount} — choose a method`,
  },
  numberLabel: { bn: (method: string) => `${method} নাম্বার`, en: (method: string) => `${method} number` },
  next: { bn: "পরবর্তী", en: "Next" },
  goBack: { bn: "ফিরে যাও", en: "Go back" },
  enterPin: { bn: "PIN দাও", en: "Enter PIN" },
  payAmount: { bn: (amount: string) => `পে করো ৳${amount}`, en: (amount: string) => `Pay ৳${amount}` },
  paymentProcessing: { bn: "পেমেন্ট প্রসেস হচ্ছে…", en: "Processing payment…" },
  paymentSuccess: { bn: "পেমেন্ট সফল হয়েছে", en: "Payment successful" },
  serialConfirming: { bn: "সিরিয়াল কনফার্ম হচ্ছে…", en: "Confirming serial…" },
  paymentFailed: { bn: "পেমেন্ট ব্যর্থ হয়েছে", en: "Payment failed" },
  tryAgain: { bn: "আবার চেষ্টা করো", en: "Try again" },

  notLoggedIn: { bn: "লগইন করা নেই", en: "Not logged in" },

  // DetailsTab
  aboutShopHeading: { bn: "দোকান সম্পর্কে", en: "About the shop" },
  noAboutAdded: { bn: "কোনো বিবরণ যোগ করা হয়নি।", en: "No description added." },
  weeklyHoursHeading: { bn: "সাপ্তাহিক সময়সূচি", en: "Weekly hours" },
  noHoursAdded: { bn: "সময়সূচি এখনো যোগ করা হয়নি।", en: "Hours haven't been added yet." },

  // GalleryTab
  noPhotosTitle: { bn: "কোনো ছবি নেই", en: "No photos" },
  noPhotosDesc: {
    bn: "এই দোকান এখনো গ্যালারিতে কোনো ছবি যোগ করেনি।",
    en: "This shop hasn't added any gallery photos yet.",
  },

  // LiveTrackingView
  noActiveSerial: { bn: "তোমার এখন কোনো সক্রিয় সিরিয়াল নেই।", en: "You don't have an active serial right now." },
  findShop: { bn: "দোকান খুঁজো", en: "Find a shop" },
  yourLiveSerial: { bn: "তোমার লাইভ সিরিয়াল", en: "Your live serial" },
  yourServiceRunning: { bn: "তোমার সার্ভিস চলছে", en: "Your service is running" },
  yourSerialComingUp: { bn: "তোমার সিরিয়াল আসতে বাকি", en: "Your serial is coming up" },
  yourSerialLabel: { bn: "তোমার সিরিয়াল", en: "Your serial" },
  aheadOfYou: { bn: (n: number) => `তোমার আগে যারা (${n} জন)`, en: (n: number) => `Ahead of you (${n})` },
  walkInCustomer: { bn: "অফ-লাইন কাস্টমার", en: "Offline customer" },
  onlineBooking: { bn: "অনলাইন বুকিং", en: "Online booking" },
  serviceMinutes: { bn: (n: number) => `~${n} মিনিটের সার্ভিস`, en: (n: number) => `~${n} min service` },
  running: { bn: "চলছে", en: "Running" },
  willStart: { bn: "শুরু হবে", en: "Starts" },
  you: { bn: "তুমি (You)", en: "You" },
  servicesLabel: { bn: "সার্ভিস", en: "Services" },
  totalLabel: { bn: "মোট", en: "Total" },
  doneReviewCta: { bn: "কাজ শেষ? রিভিউ দাও ★", en: "Done? Leave a review ★" },
  cancelling: { bn: "ক্যানসেল হচ্ছে…", en: "Cancelling…" },
  cancelSerial: { bn: "সিরিয়াল ক্যানসেল করো", en: "Cancel serial" },
} satisfies Dict;
