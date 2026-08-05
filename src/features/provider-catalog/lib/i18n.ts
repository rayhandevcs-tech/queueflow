import type { Dict } from "@/lib/i18n";

export const providerCatalogDict = {
  // Shared
  cancel: { bn: "বাতিল", en: "Cancel" },

  // ServiceForm
  serviceNamePlaceholder: { bn: "সার্ভিসের নাম (চুল কাটা)", en: "Service name (Haircut)" },
  ratePlaceholder: { bn: "রেট (৳)", en: "Rate (৳)" },
  durationPlaceholder: { bn: "সময় (মিনিট)", en: "Duration (minutes)" },
  serviceSaving: { bn: "সেভ হচ্ছে…", en: "Saving…" },
  serviceUpdate: { bn: "আপডেট করো", en: "Update" },
  serviceAdd: { bn: "যোগ করো", en: "Add" },

  // ShopSettingsForm
  shopOpenWord: { bn: "খোলা", en: "Open" },
  shopClosedWord: { bn: "বন্ধ", en: "Closed" },
  shopNameLabel: { bn: "দোকানের নাম", en: "Shop name" },
  shopNamePlaceholder: { bn: "যেমন: নিউ স্টার সেলুন", en: "e.g. New Star Salon" },
  businessTypeLabel: { bn: "ধরন", en: "Type" },
  businessTypeRequired: { bn: "একটা ধরন বেছে নাও", en: "Choose a type" },
  addressLabel: { bn: "ঠিকানা", en: "Address" },
  addressPlaceholder: { bn: "রোড, এলাকা, শহর", en: "Road, area, city" },
  phoneLabel: { bn: "ফোন", en: "Phone" },

  // LocationPickerField
  locationOnMapLabel: { bn: "ম্যাপে লোকেশন", en: "Location on map" },
  useCurrentLocationCta: { bn: "কারেন্ট লোকেশন", en: "Use current location" },
  locatingLabel: { bn: "খোঁজা হচ্ছে…", en: "Locating…" },
  tapMapHint: { bn: "দোকানের জায়গায় ম্যাপে চাপো।", en: "Tap the map to place a pin at your shop." },
  logoLabel: { bn: "লোগো", en: "Logo" },
  coverLabel: { bn: "কভার ছবি", en: "Cover photo" },
  saveBeforeUploadHint: {
    bn: "দোকান সংরক্ষণ করার পর লোগো ও কভার ছবি আপলোড করতে পারবে।",
    en: "You'll be able to upload a logo and cover photo after saving the shop.",
  },
  shopSaving: { bn: "সংরক্ষণ হচ্ছে…", en: "Saving…" },
  shopUpdate: { bn: "আপডেট করো", en: "Update" },
  shopCreate: { bn: "দোকান তৈরি করো", en: "Create shop" },
  saveFailed: { bn: "সংরক্ষণ করা যায়নি — আবার চেষ্টা করো।", en: "Couldn't save — try again." },

  // ChairForm (was hardcoded English; adding bn counterpart)
  chairLabelPlaceholder: { bn: "লেবেল (চেয়ার ১)", en: "Label (Chair 1)" },
  staffNamePlaceholder: { bn: "স্টাফের নাম (রহিম)", en: "Staff name (Rahim)" },
  laneColorLabel: { bn: "লেনের রং", en: "Lane color" },
  chairSaving: { bn: "সংরক্ষণ হচ্ছে…", en: "Saving…" },
  chairUpdate: { bn: "আপডেট করো", en: "Update" },
  chairAdd: { bn: "চেয়ার যোগ করো", en: "Add chair" },

  // ImageUploadField
  uploadFailedGeneric: { bn: "আপলোড ব্যর্থ হয়েছে", en: "Upload failed" },
  pickImage: { bn: "ছবি বাছো", en: "Choose image" },

  // ServiceForm — photo
  serviceImageLabel: { bn: "সার্ভিসের ছবি", en: "Service photo" },

  // storage.api.ts
  onlyImagesAllowed: { bn: "শুধু ছবি আপলোড করা যাবে", en: "Only images can be uploaded" },
  imageTooLarge: { bn: "ছবি ২ এমবি-র নিচে হতে হবে", en: "Image must be under 2 MB" },
  uploadFailedRetry: {
    bn: "আপলোড ব্যর্থ হয়েছে — আবার চেষ্টা করো",
    en: "Upload failed — try again",
  },

  // AboutHoursForm
  aboutLabel: { bn: "দোকান সম্পর্কে", en: "About the shop" },
  aboutPlaceholder: {
    bn: "তোমার দোকান সম্পর্কে কয়েক লাইন লেখো...",
    en: "Write a few lines about your shop...",
  },
  weeklyHoursLabel: { bn: "সাপ্তাহিক সময়সূচি", en: "Weekly hours" },
  copyToAllDays: { bn: "সব দিনে কপি করো", en: "Copy to all days" },
  dayClosedStatus: { bn: "বন্ধ", en: "Closed" },
  dayToggleOpen: { bn: "খোলা রাখো", en: "Keep open" },
  dayToggleClose: { bn: "বন্ধ রাখো", en: "Keep closed" },
  hoursSaving: { bn: "সংরক্ষণ হচ্ছে…", en: "Saving…" },
  hoursSave: { bn: "সংরক্ষণ করো", en: "Save" },

  // GalleryManager
  galleryUploadFailed: { bn: "আপলোড ব্যর্থ হয়েছে", en: "Upload failed" },
  galleryLabel: { bn: "গ্যালারি", en: "Gallery" },

  // CanPerformMatrix
  canPerformGuardHint: {
    bn: "এই টেবিল দেখতে অন্তত একটা চেয়ার আর একটা চালু সার্ভিস থাকতে হবে।",
    en: "You need at least one chair and one active service to see this table.",
  },
  matrixHeader: { bn: "সার্ভিস ↓ / চেয়ার →", en: "Service ↓ / Chair →" },
  capableCount: {
    bn: (capable: number, total: number) => `${capable}/${total} সার্ভিস পারে`,
    en: (capable: number, total: number) => `${capable}/${total} services`,
  },

  // ServicesManager
  servicesPageTitle: { bn: "সার্ভিস ও রেট", en: "Services & rates" },
  servicesPageSubtitle: {
    bn: "রেট স্বচ্ছ রাখলে কাস্টমারের হিসাবও পরিষ্কার থাকে",
    en: "Transparent rates keep the customer's bill clear too",
  },
  newServiceCta: { bn: "নতুন সার্ভিস", en: "New service" },
  noServicesTitle: { bn: "এখনো কোনো সার্ভিস যোগ করা হয়নি", en: "No services added yet" },
  noServicesDesc: {
    bn: "প্রথম সার্ভিস যোগ করো, কাস্টমাররা বুকিং শুরু করতে পারবে।",
    en: "Add your first service so customers can start booking.",
  },
  estimatedMinutes: {
    bn: (n: number) => `আনুমানিক ${n} মিনিট`,
    en: (n: number) => `About ${n} min`,
  },
  serviceActiveWord: { bn: "চালু", en: "Active" },
  serviceInactiveWord: { bn: "বন্ধ", en: "Inactive" },
  deleteServiceAria: { bn: "সার্ভিস মুছো", en: "Delete service" },
  deleteServiceTitle: { bn: "এই সার্ভিসটা মুছে ফেলবে?", en: "Delete this service?" },
  deleteServiceDesc: {
    bn: "এটা আর কাস্টমারের কাছে দেখা যাবে না, নতুন কোনো বুকিংয়েও যোগ করা যাবে না।",
    en: "It won't be visible to customers anymore, or addable to any new booking.",
  },
  deleteServiceActiveWarning: {
    bn: "এই সার্ভিসটা এখন একটা চলমান সিরিয়ালে ব্যবহৃত হচ্ছে — মুছে ফেললেও সেই কাস্টমারের কাজ প্রভাবিত হবে না, শুধু নতুন বুকিংয়ে আর দেখা যাবে না।",
    en: "This service is currently in an active serial — deleting it won't affect that customer's job, it just won't be offered for new bookings anymore.",
  },
  deleteServiceConfirm: { bn: "মুছে ফেলো", en: "Delete" },
  deleteServiceFallbackNote: {
    bn: "সরাসরি মুছে ফেলা যায়নি, তাই বন্ধ করে দেওয়া হয়েছে।",
    en: "Couldn't delete it directly, so it's been deactivated instead.",
  },

  // (provider)/settings/page.tsx
  settingsPageTitle: { bn: "দোকানের সেটিংস", en: "Shop settings" },
  settingsDescExisting: { bn: "তোমার দোকানের তথ্য আপডেট করো", en: "Update your shop's info" },
  settingsDescNew: { bn: "প্রথমে দোকান সেট আপ করো", en: "First, set up your shop" },

  // (provider)/services/page.tsx — also reused by chairs/dashboard/analytics/income pages
  noShopTitle: { bn: "আগে তোমার শপ সেট আপ করো", en: "Set up your shop first" },
  goToSettings: { bn: "সেটিংসে যাও →", en: "Go to settings →" },
  canPerformHeading: { bn: "কে কোন সার্ভিস করতে পারে", en: "Who can perform which service" },
  canPerformDesc: {
    bn: "এখানে কোনো সার্ভিস বন্ধ রাখলে সেটা ওই চেয়ারে কখনো অ্যাসাইন হবে না।",
    en: "Turning a service off here means it will never be assigned to that chair.",
  },

  // (provider)/chairs/page.tsx + ChairsManager
  chairsPageTitle: { bn: "চেয়ার ও স্টাফ", en: "Chairs & Staff" },
  chairsPageDesc: {
    bn: "প্রতিটা চেয়ার ড্যাশবোর্ডে একটা লেন — নতুন সিরিয়াল বন্ধ করতে চেয়ার পজ করো।",
    en: "Each chair is one lane on the dashboard — pause a chair to stop new serials.",
  },
  newChairCta: { bn: "নতুন চেয়ার", en: "New chair" },
  noChairsYetTitle: { bn: "এখনো কোনো চেয়ার যোগ করা হয়নি", en: "No chairs yet" },
  noChairsYetDesc: {
    bn: "প্রথম চেয়ার বা স্টাফ লেন যোগ করো, সিরিয়াল নেওয়া শুরু করতে।",
    en: "Add your first chair or staff lane to start taking serials.",
  },
  chairEditCta: { bn: "এডিট", en: "Edit" },
  chairActiveWord: { bn: "চালু", en: "Active" },
  chairPausedWord: { bn: "পজড", en: "Paused" },
  chairNoStaffName: { bn: "স্টাফের নাম নেই", en: "No staff name" },
  deleteChairAria: { bn: "চেয়ার মুছো", en: "Delete chair" },
  deleteChairTitle: { bn: "এই চেয়ারটা মুছে ফেলবে?", en: "Delete this chair?" },
  deleteChairDesc: {
    bn: "এটা আর ড্যাশবোর্ডে দেখা যাবে না, নতুন কোনো সিরিয়ালও এখানে আসবে না।",
    en: "It won't appear on the dashboard anymore, and no new serials will come here.",
  },
  deleteChairActiveWarning: {
    bn: "এই চেয়ারে এখন একটা চলমান সিরিয়াল আছে — মুছে ফেললেও সেই কাস্টমারের কাজ প্রভাবিত হবে না, শুধু চেয়ারটা পজ হয়ে যাবে।",
    en: "This chair currently has an active serial — deleting it won't affect that customer's job, it'll just get paused instead.",
  },
  deleteChairConfirm: { bn: "মুছে ফেলো", en: "Delete" },
  deleteChairFallbackNote: {
    bn: "সরাসরি মুছে ফেলা যায়নি, তাই পজ করে দেওয়া হয়েছে।",
    en: "Couldn't delete it directly, so it's been paused instead.",
  },

  // ProviderSidebar — nav labels
  navLiveQueue: { bn: "লাইভ সিরিয়াল", en: "Live queue" },
  navChairs: { bn: "চেয়ার", en: "Chairs" },
  navServices: { bn: "সার্ভিস ও রেট", en: "Services & rates" },
  navOffers: { bn: "অফার", en: "Offers" },
  navChat: { bn: "মেসেজ", en: "Messages" },
  navIncome: { bn: "ইনকাম", en: "Income" },
  navManualEntries: { bn: "ম্যানুয়াল এন্ট্রি", en: "Manual entries" },
  navDueLedger: { bn: "বাকির খাতা", en: "Due ledger" },
  navAnalytics: { bn: "অ্যানালিটিক্স", en: "Analytics" },
  navRegulars: { bn: "নিয়মিত কাস্টমার", en: "Regular customers" },
  navSendNotification: { bn: "নোটিফিকেশন পাঠান", en: "Send notification" },
  navReviews: { bn: "রিভিউ", en: "Reviews" },
  navSettings: { bn: "সেটিংস", en: "Settings" },
  comingSoon: {
    bn: (label: string) => `${label} — শীঘ্রই আসছে`,
    en: (label: string) => `${label} — Coming soon`,
  },
  accountLink: { bn: "একাউন্ট", en: "Account" },
  signOut: { bn: "সাইন আউট", en: "Sign out" },

  // Quick language toggle
  languageBnShort: { bn: "বাং", en: "বাং" },
  languageEnShort: { bn: "Eng", en: "Eng" },
  quickLanguageAria: { bn: "ভাষা বদলাও", en: "Switch language" },

  // ProviderShell
  openMenuAria: { bn: "মেনু খোলো", en: "Open menu" },
  closeMenuAria: { bn: "মেনু বন্ধ করো", en: "Close menu" },

  // AcceptedPaymentsSection
  acceptedPaymentsTitle: { bn: "গ্রহণযোগ্য পেমেন্ট", en: "Accepted payments" },
  acceptedPaymentsHint: {
    bn: "কাজ শেষে পেমেন্ট শিটে শুধু এখানে চালু করা মাধ্যমগুলোই দেখাবে",
    en: "Only the methods you turn on here will show up on the job-completion payment sheet",
  },
  cashLabel: { bn: "ক্যাশ", en: "Cash" },
  cashAlwaysOnHint: { bn: "সবসময় চালু", en: "Always on" },
  bkashLabel: { bn: "বিকাশ", en: "bKash" },
  nagadLabel: { bn: "নগদ", en: "Nagad" },
  rocketLabel: { bn: "রকেট", en: "Rocket" },
  cardLabel: { bn: "কার্ড", en: "Card" },
  comingSoonBadge: { bn: "শীঘ্রই আসছে", en: "Coming soon" },
  paymentMethodUpdateFailed: {
    bn: "আপডেট করা যায়নি — আবার চেষ্টা করো",
    en: "Couldn't update — try again",
  },
} satisfies Dict;
