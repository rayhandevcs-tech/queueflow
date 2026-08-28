import type { Dict } from "@/lib/i18n";

export const providerVoiceDict = {
  micLabel: { bn: "বলে কাজ করো", en: "Speak a command" },
  listeningTitle: { bn: "শুনছি…", en: "Listening…" },
  listeningHint: {
    bn: "বলো — যেমন “অফলাইনে সালামের হেয়ার কাটিং যোগ করো”",
    en: "Say something like “add a walk-in for Salam, hair cutting”",
  },
  stopCta: { bn: "বলা শেষ", en: "Done speaking" },
  thinking: { bn: "বুঝছি…", en: "Working it out…" },

  confirmTitle: { bn: "এটাই বললে তো?", en: "Is this right?" },
  heardLabel: { bn: "যা শুনলাম", en: "What I heard" },
  confirmCta: { bn: "হ্যাঁ, করো", en: "Yes, do it" },
  cancelCta: { bn: "বাতিল", en: "Cancel" },
  retryCta: { bn: "আবার বলো", en: "Say it again" },

  // Examples, shown before the first use so nobody has to guess the phrasing.
  examplesTitle: { bn: "যা বলতে পারো", en: "Things you can say" },
  example1: { bn: "অফলাইনে সালামের হেয়ার কাটিং যোগ করো", en: "Add a walk-in for Salam, hair cutting" },
  example2: { bn: "দোকান ভাড়া তিন হাজার টাকা খরচ লেখো", en: "Record 3000 taka shop rent" },
  example3: { bn: "দোকান বন্ধ করো", en: "Close the shop" },

  // Errors
  errUnsupported: {
    bn: "এই ব্রাউজারে কণ্ঠস্বর কাজ করে না। ক্রোম দিয়ে চেষ্টা করো, নয়তো হাতে যোগ করো।",
    en: "This browser can't do voice. Try Chrome, or add it by hand.",
  },
  errDenied: {
    bn: "মাইক্রোফোনের অনুমতি দেওয়া হয়নি। ব্রাউজারের সেটিংস থেকে অনুমতি দাও।",
    en: "Microphone permission was denied. Allow it in your browser settings.",
  },
  errNoSpeech: { bn: "কিছু শোনা গেল না। আবার বলো।", en: "I didn't hear anything. Try again." },
  errFailed: { bn: "শোনা গেল না। আবার চেষ্টা করো।", en: "That didn't work. Try again." },
  errNoServices: {
    bn: "আগে অন্তত একটা সার্ভিস যোগ করো, তারপর বলে কাজ করা যাবে.",
    en: "Add at least one service first, then voice commands will work.",
  },
  errNoKey: { bn: "এই সুবিধাটা এখনো চালু হয়নি।", en: "This feature isn't switched on yet." },
  errGeneric: { bn: "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করো।", en: "Something went wrong. Try again." },

  // Outcomes
  doneWalkIn: { bn: "কিউতে যোগ করা হয়েছে", en: "Added to the queue" },
  doneExpense: { bn: "খরচ লেখা হয়েছে", en: "Expense recorded" },
  doneIncome: { bn: "আয় লেখা হয়েছে", en: "Income recorded" },
  doneShopOpen: { bn: "দোকান খোলা হয়েছে", en: "Shop opened" },
  doneShopClosed: { bn: "দোকান বন্ধ করা হয়েছে", en: "Shop closed" },

  caveat: {
    bn: "কণ্ঠস্বর ভুল বুঝতে পারে — নিশ্চিত করার আগে পড়ে নিও।",
    en: "Voice can mishear — read it before you confirm.",
  },
} satisfies Dict;
