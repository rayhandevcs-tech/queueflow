import type { Dict } from "@/lib/i18n";

export const membershipDict = {
  // ---- Owner: page shell ----
  ownerTitle: { bn: "মেম্বারশিপ", en: "Membership" },
  ownerSubtitle: {
    bn: "নিয়মিত কাস্টমারদের জন্য নিজের প্যাকেজ — কে সদস্য, কার মেয়াদ কবে শেষ, সব এখানে।",
    en: "Your own packages for regulars — who's a member and whose runs out when.",
  },
  tabTiers: { bn: "প্যাকেজ", en: "Packages" },
  tabMembers: { bn: "সদস্য", en: "Members" },

  // ---- Owner: overview tiles ----
  tileActive: { bn: "চালু সদস্য", en: "Active members" },
  tilePending: { bn: "অনুমোদনের অপেক্ষায়", en: "Awaiting you" },
  tileExpiring: { bn: "৭ দিনে মেয়াদ শেষ", en: "Expiring in 7 days" },
  tileUnpaid: { bn: "টাকা বাকি", en: "Payment due" },

  // ---- Owner: tiers ----
  tiersHeading: { bn: "তোমার প্যাকেজগুলো", en: "Your packages" },
  newTierCta: { bn: "নতুন প্যাকেজ", en: "New package" },
  noTiersTitle: { bn: "এখনো কোনো প্যাকেজ নেই", en: "No packages yet" },
  noTiersDesc: {
    bn: "প্যাকেজ না বানানো পর্যন্ত কাস্টমার তোমার দোকানে মেম্বারশিপের কিছুই দেখবে না। চেনা চারটে দিয়ে শুরু করতে পারো, তারপর দাম নিজের মতো বদলে নাও।",
    en: "Until you make one, customers see no membership at your shop at all. Start with the familiar four, then set your own prices.",
  },
  seedPresetsCta: { bn: "চারটে প্যাকেজ দিয়ে শুরু করো", en: "Start with the four" },
  seedPresetsHint: {
    bn: "Silver · Gold · Platinum · Diamond — বসানোর পরেই দাম, মেয়াদ আর সুবিধা বদলাতে পারবে।",
    en: "Silver · Gold · Platinum · Diamond — every price, duration and benefit stays editable.",
  },
  tierActiveLabel: { bn: "চালু", en: "Active" },
  tierInactiveLabel: { bn: "বন্ধ", en: "Off" },
  tierInactiveNote: {
    bn: "বন্ধ প্যাকেজ কাস্টমার দেখে না, কিন্তু যারা আগে নিয়েছে তাদের মেয়াদ চলতেই থাকে।",
    en: "A package that's off is hidden from customers, but existing members keep their term.",
  },
  tierMembersCount: {
    bn: (n: string) => `${n} জন সদস্য`,
    en: (n: string) => `${n} member(s)`,
  },
  tierPriceFor: {
    bn: (price: string, days: string) => `৳${price} · ${days} দিন`,
    en: (price: string, days: string) => `৳${price} for ${days} days`,
  },
  editTier: { bn: "বদলাও", en: "Edit" },
  deleteTier: { bn: "মুছে ফেলো", en: "Delete" },
  deleteTierTitle: { bn: "প্যাকেজটা মুছে ফেলবে?", en: "Delete this package?" },
  deleteTierBody: {
    bn: "যাদের এই প্যাকেজ আছে তাদের কিছু হবে না — কিন্তু সদস্য থাকলে মোছাই যাবে না। শুধু বিক্রি বন্ধ করতে চাইলে 'বন্ধ' করে দাও।",
    en: "Existing members are unaffected — but a package with members cannot be deleted at all. To just stop selling it, switch it off.",
  },
  deleteTierBlocked: {
    bn: "এই প্যাকেজে সদস্য আছে, তাই মোছা যাবে না। 'বন্ধ' করে দাও।",
    en: "This package has members, so it can't be deleted. Switch it off instead.",
  },

  // ---- Owner: tier form ----
  tierNamePlaceholder: { bn: "প্যাকেজের নাম (যেমন Gold)", en: "Package name (e.g. Gold)" },
  tierDescPlaceholder: { bn: "এক লাইনে বর্ণনা (ঐচ্ছিক)", en: "One-line description (optional)" },
  tierPricePlaceholder: { bn: "দাম (৳)", en: "Price (৳)" },
  tierDurationPlaceholder: { bn: "মেয়াদ (দিন)", en: "Duration (days)" },
  tierBenefitsHeading: { bn: "সুবিধা", en: "Benefits" },
  tierBenefitsHint: {
    bn: "কাস্টমার এগুলোই পড়বে। এখন এগুলো শুধু লেখা থাকে — অ্যাপ নিজে থেকে ছাড় বসাবে না, তুমি কাউন্টারে দেবে।",
    en: "This is what customers read. For now they're a written promise — the app doesn't apply them yet, you honour them at the counter.",
  },
  addBenefit: { bn: "সুবিধা যোগ করো", en: "Add a benefit" },
  removeBenefit: { bn: "সরাও", en: "Remove" },
  benefitLabelPlaceholder: { bn: "কী পাবে, কাস্টমারের ভাষায়", en: "What they get, in their words" },
  benefitValuePlaceholder: { bn: "শতকরা / সংখ্যা", en: "Percent / count" },
  tierSave: { bn: "রাখো", en: "Save" },
  tierUpdate: { bn: "আপডেট করো", en: "Update" },
  tierSaving: { bn: "রাখা হচ্ছে…", en: "Saving…" },
  cancel: { bn: "বাতিল", en: "Cancel" },

  // ---- Benefit kinds ----
  kindDISCOUNT: { bn: "ছাড়", en: "Discount" },
  kindFREE_SERVICE: { bn: "ফ্রি সার্ভিস", en: "Free service" },
  kindPRIORITY_BOOKING: { bn: "অগ্রাধিকার", en: "Priority" },
  kindCOMPLIMENTARY: { bn: "কমপ্লিমেন্টারি", en: "Complimentary" },
  kindSPECIAL_OFFER: { bn: "বিশেষ অফার", en: "Special offer" },

  // ---- Owner: members ----
  membersHeading: { bn: "সদস্যরা", en: "Members" },
  noMembersTitle: { bn: "এখনো কেউ সদস্য হয়নি", en: "No members yet" },
  noMembersDesc: {
    bn: "কাস্টমার তোমার দোকানের পাতা থেকে প্যাকেজ নিতে পারবে, অথবা তুমি নিজেই কাউন্টারে বসে সদস্য করতে পারো।",
    en: "Customers can join from your shop page, or you can enrol someone at the counter yourself.",
  },
  colMember: { bn: "সদস্য", en: "Member" },
  colTier: { bn: "প্যাকেজ", en: "Package" },
  colStatus: { bn: "অবস্থা", en: "Status" },
  colPaid: { bn: "টাকা", en: "Payment" },
  colStarted: { bn: "শুরু", en: "Started" },
  colExpires: { bn: "মেয়াদ শেষ", en: "Expires" },
  filterAll: { bn: "সব", en: "All" },
  filterPending: { bn: "অপেক্ষায়", en: "Pending" },
  filterActive: { bn: "চালু", en: "Active" },
  filterExpiring: { bn: "মেয়াদ ফুরাচ্ছে", en: "Expiring" },
  filterEnded: { bn: "শেষ হয়েছে", en: "Ended" },
  membersLoadFailed: {
    bn: "সদস্য তালিকা আনা গেল না। একটু পরে আবার চেষ্টা করো।",
    en: "Couldn't load the members. Try again in a moment.",
  },
  noFilterMatch: { bn: "এই ফিল্টারে কেউ নেই", en: "Nobody matches this filter" },
  noFilterMatchDesc: {
    bn: "অন্য ট্যাব দেখো, অথবা 'সব' দিয়ে পুরো তালিকা দেখো।",
    en: "Try another tab, or 'All' for the whole list.",
  },

  // ---- Statuses ----
  statusPENDING: { bn: "অপেক্ষায়", en: "Pending" },
  statusACTIVE: { bn: "চালু", en: "Active" },
  statusEXPIRED: { bn: "মেয়াদ শেষ", en: "Expired" },
  statusCANCELLED: { bn: "বাতিল", en: "Cancelled" },
  paidTag: { bn: "টাকা পেয়েছ", en: "Paid" },
  unpaidTag: { bn: "বাকি", en: "Due" },
  daysLeft: {
    bn: (n: string) => `${n} দিন বাকি`,
    en: (n: string) => `${n} day(s) left`,
  },
  expiredOn: {
    bn: (date: string) => `${date}-এ শেষ হয়েছে`,
    en: (date: string) => `Ended ${date}`,
  },

  // ---- Owner: actions on one membership ----
  memberSheetTitle: { bn: "সদস্যপদ", en: "Membership" },
  activateCta: { bn: "চালু করো", en: "Activate" },
  activateTitle: { bn: "টাকা পেয়েছ?", en: "Did you get paid?" },
  activateYes: { bn: "হ্যাঁ, চালু করো", en: "Yes, activate" },
  activateNo: { bn: "না, বাকি রেখে চালু করো", en: "No — activate on credit" },
  activateNoHint: {
    bn: "সদস্যপদ চালু হবে, কিন্তু টাকা বাকি হিসেবে থাকবে।",
    en: "The membership starts, but the payment stays outstanding.",
  },
  markPaidCta: { bn: "টাকা পেয়েছি", en: "Mark as paid" },
  cancelMembershipCta: { bn: "সদস্যপদ বাতিল করো", en: "Cancel membership" },
  cancelMembershipTitle: { bn: "সদস্যপদ বাতিল করবে?", en: "Cancel this membership?" },
  cancelMembershipBody: {
    bn: "সদস্যপদ বন্ধ হয়ে যাবে আর সারিটা ইতিহাসে থেকে যাবে। মুছে ফেলা যায় না — এটা টাকার হিসাব।",
    en: "It stops, and the row stays as history. It can't be deleted — it's a money record.",
  },
  methodTitle: { bn: "কীভাবে পেলে?", en: "How did they pay?" },
  payBack: { bn: "ফিরে যাও", en: "Go back" },
  pay_cash: { bn: "নগদ টাকা", en: "Cash" },
  pay_bkash: { bn: "বিকাশ", en: "bKash" },
  pay_nagad: { bn: "নগদ", en: "Nagad" },
  pay_rocket: { bn: "রকেট", en: "Rocket" },
  pay_card: { bn: "কার্ড", en: "Card" },
  enrollCta: { bn: "কাউন্টার থেকে সদস্য করো", en: "Enrol at the counter" },
  enrollTitle: { bn: "সদস্য করো", en: "Enrol a member" },
  enrollPickCustomer: { bn: "কাস্টমার বেছে নাও", en: "Pick a customer" },
  enrollPickTier: { bn: "প্যাকেজ বেছে নাও", en: "Pick a package" },
  enrollNoCustomers: {
    bn: "এই দোকানে আগে কাজ করানো কোনো কাস্টমার এখনো নেই। কাউন্টার থেকে সদস্য করতে অন্তত একবার সার্ভিস নেওয়া লাগবে — নইলে কাস্টমার নিজের পাতা থেকেই নিতে পারবে।",
    en: "Nobody has been served here yet. Counter enrolment needs at least one past visit — otherwise customers can join from your shop page themselves.",
  },
  enrollNote: { bn: "নোট (ঐচ্ছিক)", en: "Note (optional)" },
  enrollSubmit: { bn: "সদস্য করো", en: "Enrol" },
  enrollDone: { bn: "সদস্য করা হয়েছে।", en: "Enrolled." },
  alreadyMember: {
    bn: "এই কাস্টমারের এই দোকানে একটা চালু সদস্যপদ আছেই।",
    en: "This customer already has a live membership here.",
  },

  // ---- Customer: shop page ----
  shopTabLabel: { bn: "মেম্বারশিপ", en: "Membership" },
  shopTiersHeading: { bn: "এই দোকানের মেম্বারশিপ", en: "Membership at this shop" },
  shopTiersIntro: {
    bn: "একবার নিলে মেয়াদ পর্যন্ত এই দোকানে সুবিধাগুলো পাবে। প্রতিটা দোকানের মেম্বারশিপ আলাদা — এখানকারটা অন্য দোকানে চলবে না।",
    en: "Join once and get these at this shop for the whole term. Each shop's membership is its own — this one isn't valid anywhere else.",
  },
  shopNoTiersTitle: { bn: "এই দোকানে মেম্বারশিপ নেই", en: "No membership here" },
  shopNoTiersDesc: {
    bn: "দোকানটা এখনো কোনো মেম্বারশিপ প্যাকেজ চালু করেনি।",
    en: "This shop hasn't set up any membership packages yet.",
  },
  forDays: {
    bn: (n: string) => `${n} দিনের জন্য`,
    en: (n: string) => `for ${n} days`,
  },
  joinCta: { bn: "এই প্যাকেজ নাও", en: "Join this package" },
  joinPendingTitle: { bn: "অনুরোধ পৌঁছে গেছে", en: "Request sent" },
  joinPendingBody: {
    bn: "দোকানে গিয়ে টাকা দিলেই মালিক সদস্যপদ চালু করে দেবে। এই অ্যাপে অনলাইনে টাকা নেওয়ার ব্যবস্থা এখনো নেই।",
    en: "Pay at the shop and the owner will activate it. This app can't take money online yet.",
  },
  joinRequestedToast: { bn: "অনুরোধ পাঠানো হয়েছে।", en: "Request sent." },
  myMembershipHeading: { bn: "তোমার সদস্যপদ", en: "Your membership" },
  cancelRequestCta: { bn: "অনুরোধ বাতিল করো", en: "Cancel request" },
  leaveMembershipCta: { bn: "সদস্যপদ ছেড়ে দাও", en: "Leave membership" },
  leaveTitle: { bn: "সদস্যপদ ছাড়বে?", en: "Leave this membership?" },
  leaveBody: {
    bn: "মেয়াদ থাকলেও সুবিধাগুলো বন্ধ হয়ে যাবে, আর টাকা ফেরত আসে না। পরে আবার নিতে পারবে।",
    en: "The benefits stop even if the term hasn't ended, and there's no refund. You can join again later.",
  },
  cannotJoinTwice: {
    bn: "তোমার এই দোকানে একটা সদস্যপদ চলছে।",
    en: "You already have a membership running here.",
  },

  // ---- Customer: profile ----
  profileHeading: { bn: "মেম্বারশিপ", en: "Memberships" },
  profileEmpty: {
    bn: "এখনো কোনো দোকানের সদস্য হও নি। দোকানের পাতায় 'মেম্বারশিপ' ট্যাবে দেখে নিতে পারো।",
    en: "You're not a member anywhere yet. Look for the Membership tab on a shop's page.",
  },
  profileSeeShop: { bn: "দোকান দেখো", en: "View shop" },

  // ---- Shared ----
  loadFailed: {
    bn: "আনা গেল না। একটু পরে আবার চেষ্টা করো।",
    en: "Couldn't load that. Try again in a moment.",
  },
  noName: { bn: "নাম দেওয়া হয়নি", en: "No name given" },
} satisfies Dict;
