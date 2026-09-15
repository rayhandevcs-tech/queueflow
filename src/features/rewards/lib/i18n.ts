import type { Dict } from "@/lib/i18n";

export const rewardsDict = {
  // ---- Owner: page shell ----
  ownerTitle: { bn: "রিওয়ার্ড", en: "Rewards" },
  ownerSubtitle: {
    bn: "কাস্টমার জমানো পয়েন্ট দিয়ে যা নিতে পারে। কী দেবে, কত পয়েন্টে — সব তুমি ঠিক করো।",
    en: "What a customer can take with the points they've saved. You decide what, and for how many.",
  },
  needsLoyaltyTitle: { bn: "আগে পয়েন্ট প্রোগ্রাম চালু করতে হবে", en: "Switch on points first" },
  needsLoyaltyBody: {
    bn: "রিওয়ার্ড কেনা হয় লয়্যালটি পয়েন্ট দিয়ে — আলাদা কোনো হিসাব নেই। পয়েন্ট প্রোগ্রাম বন্ধ থাকলে কারো পয়েন্টই জমবে না, তাই রিওয়ার্ড নেওয়ার কিছু থাকবে না।",
    en: "Rewards are bought with loyalty points — there is no separate balance. While points are off, nobody earns any, so there is nothing to spend.",
  },
  goToLoyalty: { bn: "পয়েন্টের পাতায় যাও", en: "Go to points" },

  // ---- Owner: tiles ----
  tileTotal: { bn: "মোট রিওয়ার্ড", en: "Rewards" },
  tileAvailable: { bn: "এখন নেওয়া যায়", en: "On the shelf" },
  tileCheapest: { bn: "সবচেয়ে কম পয়েন্টে", en: "Cheapest" },
  tileIssued: { bn: "ইস্যু করা কুপন", en: "Coupons issued" },

  // ---- Owner: catalogue ----
  catalogueHeading: { bn: "রিওয়ার্ড ক্যাটালগ", en: "Reward catalogue" },
  newReward: { bn: "নতুন রিওয়ার্ড", en: "New reward" },
  colReward: { bn: "রিওয়ার্ড", en: "Reward" },
  colKind: { bn: "ধরন", en: "Type" },
  colCost: { bn: "পয়েন্ট", en: "Points" },
  colStock: { bn: "বাকি", en: "Left" },
  colState: { bn: "অবস্থা", en: "State" },
  emptyTitle: { bn: "এখনো কোনো রিওয়ার্ড নেই", en: "No rewards yet" },
  emptyBody: {
    bn: "একটা রিওয়ার্ড বানাও — যেমন “২০০ পয়েন্টে একটা ফ্রি ফেসিয়াল”। কাস্টমার তখন দোকানের পাতায় দেখতে পাবে।",
    en: "Create one — say “a free facial for 200 points”. Customers then see it on your shop page.",
  },
  loadFailed: { bn: "তালিকাটা আনা গেল না — আবার চেষ্টা করো।", en: "Couldn't load the list — try again." },

  // ---- Reward kinds ----
  kindDISCOUNT_FLAT: { bn: "টাকার ছাড়", en: "Taka off" },
  kindDISCOUNT_PCT: { bn: "শতকরা ছাড়", en: "Percent off" },
  kindFREE_SERVICE: { bn: "ফ্রি সার্ভিস", en: "Free service" },
  kindFlatHint: {
    bn: "বিল থেকে সরাসরি টাকা বাদ যাবে।",
    en: "A flat amount comes off the bill.",
  },
  kindPctHint: {
    bn: "বিলের শতকরা হিসাবে ছাড় যাবে।",
    en: "A percentage of the bill comes off.",
  },
  kindFreeHint: {
    bn: "একটা নির্দিষ্ট সার্ভিস ফ্রি। বিলে ওই সার্ভিসটা থাকলেই ছাড় বসবে।",
    en: "One named service, free. It applies when that service is on the bill.",
  },
  valueFlat: { bn: (taka: string) => `৳${taka} ছাড়`, en: (taka: string) => `৳${taka} off` },
  valuePct: { bn: (pct: string) => `${pct}% ছাড়`, en: (pct: string) => `${pct}% off` },
  valueFree: { bn: (name: string) => `${name} ফ্রি`, en: (name: string) => `${name} free` },

  // ---- Owner: the form ----
  formNewTitle: { bn: "নতুন রিওয়ার্ড", en: "New reward" },
  formEditTitle: { bn: "রিওয়ার্ড বদলাও", en: "Edit reward" },
  nameLabel: { bn: "নাম", en: "Name" },
  namePlaceholder: { bn: "যেমন ফ্রি ফেসিয়াল", en: "e.g. Free facial" },
  descriptionLabel: { bn: "বিবরণ", en: "Description" },
  descriptionHint: {
    bn: "শর্ত থাকলে এখানে লেখো — কাস্টমার এটাই পড়বে।",
    en: "Any conditions go here — this is what the customer reads.",
  },
  kindLabel: { bn: "ধরন", en: "Type" },
  pointsCostLabel: { bn: "কত পয়েন্টে", en: "Points cost" },
  pointsCostHint: {
    bn: "কাস্টমারের এই কয়টা পয়েন্ট কাটা যাবে।",
    en: "This many points come off the customer's balance.",
  },
  flatValueLabel: { bn: "কত টাকা ছাড়", en: "Taka off" },
  pctValueLabel: { bn: "কত শতাংশ ছাড়", en: "Percent off" },
  serviceLabel: { bn: "কোন সার্ভিস ফ্রি", en: "Which service" },
  servicePlaceholder: { bn: "সার্ভিস বেছে নাও", en: "Choose a service" },
  stockLabel: { bn: "কতটা দেবে", en: "How many" },
  stockHint: {
    bn: "খালি রাখলে সীমা নেই। সংখ্যা দিলে ওই কয়টা ইস্যু হওয়ার পর আর নেওয়া যাবে না।",
    en: "Leave empty for no limit. A number stops it after that many are issued.",
  },
  validUntilLabel: { bn: "কত তারিখ পর্যন্ত", en: "Valid until" },
  validUntilHint: {
    bn: "খালি রাখলে মেয়াদ নেই। তারিখ দিলে ইস্যু করা কুপনের মেয়াদও ওই দিনই শেষ।",
    en: "Leave empty for no deadline. A date also becomes the deadline on every coupon issued.",
  },
  sortOrderLabel: { bn: "ক্রম", en: "Order" },
  activeLabel: { bn: "চালু", en: "Active" },
  inactiveLabel: { bn: "বন্ধ", en: "Off" },
  activeHint: {
    bn: "বন্ধ রাখলে কাস্টমার দোকানের পাতায় এটা দেখবে না।",
    en: "While it's off, customers don't see it on your shop page.",
  },
  save: { bn: "রাখো", en: "Save" },
  saving: { bn: "রাখা হচ্ছে…", en: "Saving…" },
  cancel: { bn: "বাতিল", en: "Cancel" },
  edit: { bn: "বদলাও", en: "Edit" },
  outOfStock: { bn: "শেষ", en: "Sold out" },
  unlimited: { bn: "সীমা নেই", en: "No limit" },
  offerExpired: { bn: "মেয়াদ শেষ", en: "Expired" },
  activeState: { bn: "চালু", en: "Live" },
  inactiveState: { bn: "বন্ধ", en: "Off" },
  noServices: {
    bn: "আগে একটা সার্ভিস যোগ করতে হবে, তারপর ফ্রি সার্ভিসের রিওয়ার্ড বানানো যাবে।",
    en: "Add a service first, then you can offer one free.",
  },

  // ---- Owner: verifying a coupon ----
  verifyHeading: { bn: "কুপন যাচাই করো", en: "Check a coupon" },
  verifyIntro: {
    bn: "কাস্টমারের কোডটা লিখে কোন কাজের বিলে বসবে বেছে নাও। কাজ শেষ হলেই বিল থেকে টাকা বাদ যাবে।",
    en: "Type the customer's code and pick which job it applies to. The bill drops when the job is finished.",
  },
  verifyCta: { bn: "কুপন যাচাই", en: "Check a coupon" },
  codeLabel: { bn: "কুপন কোড", en: "Coupon code" },
  codePlaceholder: { bn: "যেমন AB7K2M", en: "e.g. AB7K2M" },
  codeShapeError: {
    bn: "কোড ৬–১২টা অক্ষর বা সংখ্যার হয়। আবার দেখো।",
    en: "A code is 6–12 letters or digits. Check it again.",
  },
  lookUp: { bn: "খুঁজে দেখো", en: "Look it up" },
  lookingUp: { bn: "খোঁজা হচ্ছে…", en: "Looking…" },
  couponFound: { bn: "কুপনটা পাওয়া গেছে", en: "Coupon found" },
  couponNotFound: {
    bn: "এই দোকানে এই কোডটা নেই। বানানটা আরেকবার দেখো — অন্য দোকানের কুপন এখানে চলে না।",
    en: "No such code at this shop. Check the spelling — a coupon from another shop won't work here.",
  },
  couponUsedAlready: { bn: "এই কুপনটা আগেই ব্যবহার হয়ে গেছে", en: "This coupon has already been used" },
  couponExpiredAlready: { bn: "এই কুপনের মেয়াদ শেষ", en: "This coupon has expired" },
  pickBooking: { bn: "কোন কাজের বিলে", en: "Which job" },
  pickBookingHint: {
    bn: "এই কাস্টমারের চলতি কাজগুলো। কুপনটা শুধু নিজের কাস্টমারের বিলেই বসে।",
    en: "This customer's open jobs. A coupon only applies to its own customer's bill.",
  },
  noOpenBooking: {
    bn: "এই কাস্টমারের এখন কোনো চলতি কাজ নেই। আগে সিরিয়াল বা অ্যাপয়েন্টমেন্ট নাও, তারপর কুপনটা বসাও।",
    en: "This customer has no open job right now. Take the booking first, then apply the coupon.",
  },
  bookingSerial: { bn: "সিরিয়াল", en: "Queue" },
  bookingAppointment: { bn: "অ্যাপয়েন্টমেন্ট", en: "Appointment" },
  applyCoupon: { bn: "কুপনটা বসাও", en: "Apply the coupon" },
  applying: { bn: "বসানো হচ্ছে…", en: "Applying…" },
  appliedTitle: { bn: "কুপনটা বসে গেছে", en: "Coupon applied" },
  appliedBody: {
    bn: (discount: string, before: string, after: string) =>
      `৳${discount} ছাড় — বিল ৳${before} থেকে ৳${after}। কাজটা শেষ করলেই নতুন অঙ্কটা বসে যাবে।`,
    en: (discount: string, before: string, after: string) =>
      `৳${discount} off — the bill goes from ৳${before} to ৳${after}. Finish the job and the new figure lands.`,
  },
  done: { bn: "ঠিক আছে", en: "Done" },

  // ---- Customer: the shop tab ----
  shopTabLabel: { bn: "রিওয়ার্ড", en: "Rewards" },
  shopHeading: { bn: "পয়েন্ট দিয়ে যা নিতে পারো", en: "What your points can get you" },
  myBalanceHere: {
    bn: (points: string) => `এই দোকানে তোমার ${points} পয়েন্ট`,
    en: (points: string) => `You have ${points} points at this shop`,
  },
  balanceShopOnly: {
    bn: "পয়েন্ট দোকান-ভিত্তিক — এখানকার পয়েন্ট শুধু এখানেই চলে।",
    en: "Points belong to one shop — these work here only.",
  },
  noBalanceYet: {
    bn: "এখানে এখনো তোমার কোনো পয়েন্ট জমেনি। একটা কাজ করালেই জমা শুরু হবে।",
    en: "You have no points here yet. They start adding up from your first job.",
  },
  shopNoRewards: { bn: "এই দোকানে এখনো কোনো রিওয়ার্ড নেই", en: "No rewards here yet" },
  shopNoRewardsDesc: {
    bn: "দোকান রিওয়ার্ড যোগ করলে এখানে দেখতে পাবে।",
    en: "They'll show up here when the shop adds some.",
  },
  costLabel: { bn: (points: string) => `${points} পয়েন্ট`, en: (points: string) => `${points} points` },
  redeem: { bn: "নাও", en: "Get it" },
  redeeming: { bn: "নেওয়া হচ্ছে…", en: "Getting it…" },
  blockNOT_ENOUGH_POINTS: {
    bn: (short: string) => `আরো ${short} পয়েন্ট লাগবে`,
    en: (short: string) => `${short} more points needed`,
  },
  blockOUT_OF_STOCK: { bn: "শেষ হয়ে গেছে", en: "All gone" },
  blockOFFER_EXPIRED: { bn: "মেয়াদ শেষ", en: "Expired" },
  blockINACTIVE: { bn: "এখন নেওয়া যাচ্ছে না", en: "Not available" },
  stockLeft: { bn: (n: string) => `আর ${n}টা`, en: (n: string) => `${n} left` },
  validTill: { bn: (date: string) => `${date} পর্যন্ত`, en: (date: string) => `until ${date}` },
  loginToRedeem: { bn: "নিতে হলে লগইন করো", en: "Log in to redeem" },
  redeemedTitle: { bn: "কুপনটা তোমার", en: "The coupon is yours" },
  redeemedBody: {
    bn: "কাউন্টারে এই কোডটা দেখাও। দোকান যাচাই করে বিল থেকে টাকা বাদ দেবে।",
    en: "Show this code at the counter. The shop checks it and takes the amount off your bill.",
  },
  redeemedBalance: {
    bn: (points: string) => `এখন তোমার ${points} পয়েন্ট`,
    en: (points: string) => `You now have ${points} points`,
  },
  copyCode: { bn: "কোড কপি করো", en: "Copy code" },
  copied: { bn: "কপি হয়েছে", en: "Copied" },
  copyFailed: { bn: "কপি করা গেল না — হাতে লিখে নাও।", en: "Couldn't copy — note it down." },
  redeemFailed: { bn: "নেওয়া গেল না — আবার চেষ্টা করো।", en: "Couldn't redeem — try again." },

  // ---- Customer: my coupons ----
  profileHeading: { bn: "আমার কুপন", en: "My coupons" },
  profileIntro: {
    bn: "পয়েন্ট দিয়ে নেওয়া রিওয়ার্ড। প্রতিটা কুপন শুধু নিজের দোকানেই চলে।",
    en: "Rewards you've taken with points. Each coupon works only at its own shop.",
  },
  stateUSABLE: { bn: "ব্যবহার করা যাবে", en: "Ready to use" },
  stateUSED: { bn: "ব্যবহৃত", en: "Used" },
  stateEXPIRED: { bn: "মেয়াদ শেষ", en: "Expired" },
  usedOn: { bn: (date: string) => `${date}-এ ব্যবহৃত`, en: (date: string) => `used on ${date}` },
  savedTaka: { bn: (taka: string) => `৳${taka} বেঁচেছে`, en: (taka: string) => `saved ৳${taka}` },
  spentPoints: { bn: (points: string) => `${points} পয়েন্ট`, en: (points: string) => `${points} points` },
  expiresOn: { bn: (date: string) => `${date} পর্যন্ত`, en: (date: string) => `until ${date}` },
} satisfies Dict;
