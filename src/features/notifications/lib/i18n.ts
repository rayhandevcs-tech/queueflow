import type { Dict } from "@/lib/i18n";

export const notificationsDict = {
  // BroadcastForm
  recentCustomers: { bn: "সাম্প্রতিক কাস্টমার", en: "Recent customers" },
  recentCustomersHint: { bn: "গত ৩০ দিনে বুকিং করেছে", en: "Booked in the last 30 days" },
  regularCustomers: { bn: "নিয়মিত কাস্টমার", en: "Regular customers" },
  regularCustomersHint: { bn: "কমপক্ষে ২ বার সার্ভিস নিয়েছে", en: "Used the service at least twice" },
  sentToCount: {
    bn: (n: number) => `${n} জন কাস্টমারকে পাঠানো হয়েছে।`,
    en: (n: number) => `Sent to ${n} customers.`,
  },
  somethingWrong: { bn: "কিছু একটা ভুল হয়েছে", en: "Something went wrong" },
  sendNotificationTitle: { bn: "নোটিফিকেশন পাঠান", en: "Send notification" },
  sendNotificationSubtitle: {
    bn: "তোমার কাস্টমারদের কাছে সরাসরি একটা মেসেজ পাঠাও — দিনে একবার।",
    en: "Send a direct message to your customers — once a day.",
  },
  targetLabel: { bn: "টার্গেট", en: "Target" },
  titleLabel: { bn: "টাইটেল", en: "Title" },
  titlePlaceholder: { bn: "যেমন: আজ ২০% ছাড়!", en: "e.g. 20% off today!" },
  messageLabel: { bn: "মেসেজ", en: "Message" },
  messagePlaceholder: { bn: "বিস্তারিত লিখো…", en: "Write the details…" },
  send: { bn: "পাঠাও", en: "Send" },
  noShopTitle: { bn: "আগে তোমার শপ সেট আপ করো", en: "Set up your shop first" },
  goToSettings: { bn: "সেটিংসে যাও →", en: "Go to settings →" },

  // NotificationCenter
  noNotificationsTitle: { bn: "এখনো কোনো নোটিফিকেশন নেই", en: "No notifications yet" },
  noNotificationsDesc: {
    bn: "সিরিয়াল নিয়ে কিছু ঘটলে এখানে জানানো হবে।",
    en: "You'll be notified here when something happens with your serial.",
  },
  notificationsHeading: { bn: "নোটিফিকেশন", en: "Notifications" },
  markAllRead: { bn: "সব read করো", en: "Mark all read" },
  today: { bn: "আজ", en: "Today" },
  yesterday: { bn: "গতকাল", en: "Yesterday" },

  // NotificationBell
  notificationsAria: { bn: "নোটিফিকেশন", en: "Notifications" },
} satisfies Dict;
