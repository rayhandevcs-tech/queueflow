import type { Dict } from "@/lib/i18n";

export const referralDict = {
  // ---- Owner: page shell ----
  ownerTitle: { bn: "রেফারেল", en: "Referrals" },
  ownerSubtitle: {
    bn: "পুরনো কাস্টমার নতুন কাউকে আনলে দুজনেই পয়েন্ট পায়। কে কতজন এনেছে, সব এখানে।",
    en: "When a regular brings someone new, both get points. Who brought how many, all here.",
  },

  // ---- Owner: the switch ----
  settingsHeading: { bn: "রেফারেলের নিয়ম", en: "Referral rules" },
  enabledLabel: { bn: "রেফারেল চালু", en: "Referral on" },
  disabledLabel: { bn: "রেফারেল বন্ধ", en: "Referral off" },
  enabledHint: {
    bn: "কাস্টমার নিজের কোড শেয়ার করতে পারবে। নতুন কাস্টমারের প্রথম কাজ শেষ হলেই দুজনের পয়েন্ট জমবে।",
    en: "Customers can share their own code. Points land for both once the newcomer's first job is done.",
  },
  needsLoyaltyTitle: { bn: "আগে পয়েন্ট প্রোগ্রাম চালু করতে হবে", en: "Switch on points first" },
  needsLoyaltyBody: {
    bn: "রেফারেলের পুরস্কার লয়্যালটি পয়েন্ট — আলাদা কোনো হিসাব নেই। তাই পয়েন্ট প্রোগ্রাম বন্ধ থাকলে রেফারেল চালু করা যায় না।",
    en: "A referral reward is a loyalty point — there is no separate balance. So referral can't be switched on while points are off.",
  },
  goToLoyalty: { bn: "পয়েন্টের পাতায় যাও", en: "Go to points" },
  offNoticeTitle: { bn: "রেফারেল এখনো বন্ধ", en: "Referral is off" },
  offNoticeBody: {
    bn: "চালু করলে প্রতিটা কাস্টমার এই দোকানের জন্য নিজের একটা কোড পাবে। কেউ শুধু কোড লিখলেই পয়েন্ট পায় না — নতুন কাস্টমারের একটা কাজ সত্যিই শেষ হতে হয়।",
    en: "Switch it on and every customer gets their own code for this shop. Typing a code earns nothing — the newcomer has to actually finish a job.",
  },
  referrerPointsLabel: { bn: "যে আনবে তার পয়েন্ট", en: "Points for the referrer" },
  referrerPointsHint: {
    bn: "নতুন কাস্টমারের প্রথম কাজ শেষ হলে এই পয়েন্ট পুরনো কাস্টমারের খাতায় জমবে।",
    en: "Credited to the existing customer once the newcomer's first job is done.",
  },
  referredPointsLabel: { bn: "যে আসবে তার পয়েন্ট", en: "Points for the newcomer" },
  referredPointsHint: {
    bn: "নতুন কাস্টমার নিজেও কিছু পাবে। ০ দিলে শুধু আনার জন্য পুরস্কার থাকবে।",
    en: "The newcomer gets something too. Put 0 to reward only the referrer.",
  },
  currentReward: {
    bn: (referrer: string, referred: string) => `আনলে ${referrer} · এলে ${referred} পয়েন্ট`,
    en: (referrer: string, referred: string) =>
      `${referrer} for bringing · ${referred} for coming`,
  },
  rewardNoneForNewcomer: { bn: "নতুন কাস্টমার পয়েন্ট পাবে না", en: "The newcomer gets nothing" },
  settingsSave: { bn: "রাখো", en: "Save" },
  settingsSaving: { bn: "রাখা হচ্ছে…", en: "Saving…" },
  cancel: { bn: "বাতিল", en: "Cancel" },
  editRules: { bn: "নিয়ম বদলাও", en: "Edit rules" },

  // ---- Owner: tiles ----
  tileReferrers: { bn: "যারা এনেছে", en: "People referring" },
  tileClaimed: { bn: "কোড দিয়েছে যারা", en: "Codes claimed" },
  tileConverted: { bn: "সত্যিই এসেছে", en: "Actually came" },
  tilePoints: { bn: "রেফারেলে দেওয়া পয়েন্ট", en: "Points given for referrals" },

  // ---- Owner: the table ----
  tableHeading: { bn: "কে কতজন এনেছে", en: "Who brought how many" },
  colReferrer: { bn: "কাস্টমার", en: "Customer" },
  colCode: { bn: "কোড", en: "Code" },
  colBrought: { bn: "কোড দিয়েছে", en: "Claimed" },
  colCame: { bn: "এসেছে", en: "Came" },
  colPoints: { bn: "পয়েন্ট", en: "Points" },
  colLast: { bn: "শেষ", en: "Latest" },
  emptyTitle: { bn: "এখনো কেউ কাউকে আনেনি", en: "Nobody has brought anyone yet" },
  emptyBody: {
    bn: "কাস্টমার তার কোড শেয়ার করলে আর নতুন কেউ সেটা দিয়ে এলে এই তালিকাটা ভরবে।",
    en: "This fills up when a customer shares their code and someone new arrives with it.",
  },
  loadFailed: { bn: "তালিকাটা আনা গেল না — আবার চেষ্টা করো।", en: "Couldn't load the list — try again." },

  // ---- Customer: the share card ----
  shopTabLabel: { bn: "রেফারেল", en: "Refer" },
  shareHeading: { bn: "বন্ধুকে আনো, দুজনেই পয়েন্ট পাও", en: "Bring a friend, both get points" },
  shareIntro: {
    bn: (referrer: string, referred: string) =>
      `তোমার কোডে কেউ প্রথমবার কাজ করালে তুমি ${referrer} পয়েন্ট পাবে, আর সে পাবে ${referred}।`,
    en: (referrer: string, referred: string) =>
      `When someone books their first job with your code, you get ${referrer} points and they get ${referred}.`,
  },
  shareIntroReferrerOnly: {
    bn: (referrer: string) =>
      `তোমার কোডে কেউ প্রথমবার কাজ করালে তুমি ${referrer} পয়েন্ট পাবে।`,
    en: (referrer: string) =>
      `When someone books their first job with your code, you get ${referrer} points.`,
  },
  myCodeLabel: { bn: "তোমার কোড", en: "Your code" },
  getCode: { bn: "আমার কোড নাও", en: "Get my code" },
  gettingCode: { bn: "কোড বানানো হচ্ছে…", en: "Making your code…" },
  codeHint: {
    bn: "কোডটা শুধু এই দোকানের জন্য। অন্য দোকানে আলাদা কোড পাবে।",
    en: "This code works at this shop only. Other shops give you a separate one.",
  },
  shareOnWhatsApp: { bn: "WhatsApp-এ পাঠাও", en: "Send on WhatsApp" },
  copyCode: { bn: "কোড কপি করো", en: "Copy code" },
  copied: { bn: "কপি হয়েছে", en: "Copied" },
  copyFailed: { bn: "কপি করা গেল না — হাতে লিখে নাও।", en: "Couldn't copy — note it down." },
  codeFailed: { bn: "কোডটা আনা গেল না — আবার চেষ্টা করো।", en: "Couldn't get your code — try again." },

  // ---- Customer: my referrals list ----
  myListHeading: { bn: "তোমার রেফারেল", en: "Your referrals" },
  myListEmpty: {
    bn: "এখনো কেউ তোমার কোড ব্যবহার করেনি।",
    en: "Nobody has used your code yet.",
  },
  statusPending: { bn: "অপেক্ষায়", en: "Waiting" },
  statusConverted: { bn: "এসেছে", en: "Came" },
  pendingHint: {
    bn: "কোড দিয়েছে, কিন্তু এখনো কাজ করায়নি — কাজ শেষ হলেই তোমার পয়েন্ট জমবে।",
    en: "Code entered, job not done yet — your points land once it is.",
  },
  earnedPoints: { bn: (points: string) => `+${points} পয়েন্ট`, en: (points: string) => `+${points} points` },
  myTotals: {
    bn: (came: string, total: string) => `${total} জন কোড দিয়েছে, ${came} জন এসেছে`,
    en: (came: string, total: string) => `${total} claimed, ${came} came`,
  },

  // ---- Customer: entering someone else's code ----
  claimHeading: { bn: "কারো রেফারেল কোড আছে?", en: "Got someone's referral code?" },
  claimIntro: {
    bn: (points: string) =>
      `বুকিংয়ের আগে কোডটা দিয়ে রাখো। এই দোকানে তোমার প্রথম কাজ শেষ হলেই ${points} পয়েন্ট জমবে।`,
    en: (points: string) =>
      `Enter it before you book. You'll get ${points} points once your first job here is done.`,
  },
  claimIntroNoBonus: {
    bn: "বুকিংয়ের আগে কোডটা দিয়ে রাখো — যে তোমাকে এনেছে সে পয়েন্ট পাবে।",
    en: "Enter it before you book — the person who brought you gets points.",
  },
  claimCodeLabel: { bn: "রেফারেল কোড", en: "Referral code" },
  claimCodePlaceholder: { bn: "যেমন AB7K2M", en: "e.g. AB7K2M" },
  claimSubmit: { bn: "কোড দাও", en: "Apply code" },
  claimSubmitting: { bn: "দেখা হচ্ছে…", en: "Checking…" },
  claimSkip: { bn: "কোড নেই", en: "No code" },
  claimedTitle: { bn: "কোডটা লাগানো হয়েছে", en: "Code applied" },
  claimedBody: {
    bn: (points: string) =>
      `এখন এই দোকানে একটা কাজ করাও — শেষ হলেই তোমার ${points} পয়েন্ট জমবে।`,
    en: (points: string) => `Now book a job here — your ${points} points land when it's done.`,
  },
  claimedBodyNoBonus: {
    bn: "এখন এই দোকানে একটা কাজ করাও — শেষ হলে যে তোমাকে এনেছে সে পয়েন্ট পাবে।",
    en: "Now book a job here — the person who brought you gets points when it's done.",
  },
  claimedAndPaidTitle: { bn: "পয়েন্ট জমা হয়ে গেছে", en: "Points are in" },
  claimShapeError: {
    bn: "কোড ৬–১২টা অক্ষর বা সংখ্যার হয়। আবার দেখো।",
    en: "A code is 6–12 letters or digits. Check it again.",
  },
  claimAmbiguousHint: {
    bn: "কোডে শূন্য (0), এক (1), I বা L থাকে না — ও (O) নাকি শূন্য, আরেকবার দেখে নাও।",
    en: "Codes never contain 0, 1, I or L — check whether that's an O rather than a zero.",
  },
  loginToShare: { bn: "কোড পেতে লগইন করো", en: "Log in to get your code" },

  // ---- Shared ----
  programmeOff: { bn: "এই দোকানে রেফারেল চালু নেই", en: "This shop doesn't run referrals" },
  points: { bn: (n: string) => `${n} পয়েন্ট`, en: (n: string) => `${n} points` },
} satisfies Dict;
