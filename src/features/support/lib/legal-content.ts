export interface LegalSection {
  heading: { bn: string; en: string };
  body: { bn: string; en: string };
}

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: { bn: "আমরা কী তথ্য রাখি", en: "What information we keep" },
    body: {
      bn: "নাম, ফোন নম্বর, ইমেইল, প্রোফাইল ছবি, বুকিং হিস্ট্রি, চ্যাট মেসেজ আর রিভিউ — এই অ্যাপ ব্যবহার করার সময় যা যা তুমি নিজে দাও, শুধু সেটুকুই রাখা হয়।",
      en: "Name, phone number, email, profile photo, booking history, chat messages, and reviews — only what you provide yourself while using the app is kept.",
    },
  },
  {
    heading: { bn: "কীভাবে ব্যবহার হয়", en: "How it's used" },
    body: {
      bn: "তোমার সিরিয়াল ট্র্যাক করা, দোকানের সাথে যোগাযোগ, আর নোটিফিকেশন পাঠানোর জন্যই এই তথ্য ব্যবহার হয় — অন্য কোনো উদ্দেশ্যে বিক্রি বা শেয়ার করা হয় না।",
      en: "This information is used only to track your serial, let you contact the shop, and send notifications — it's never sold or shared for any other purpose.",
    },
  },
  {
    heading: { bn: "দোকানের সাথে কী শেয়ার হয়", en: "What's shared with a shop" },
    body: {
      bn: "যে দোকানে সিরিয়াল নাও, শুধু সেই দোকান তোমার নাম, ফোন নম্বর আর বুকিং তথ্য দেখতে পায় — অন্য কোনো দোকান পায় না।",
      en: "Only the shop where you booked a serial can see your name, phone number, and booking details — no other shop can.",
    },
  },
  {
    heading: { bn: "নোটিফিকেশন নিয়ন্ত্রণ", en: "Notification controls" },
    body: {
      bn: "নোটিফিকেশন সেটিংস থেকে যেকোনো ধরনের নোটিফিকেশন (বুকিং কনফার্মেশন বাদে) বন্ধ করে রাখতে পারো।",
      en: "You can turn off any notification type (except booking confirmations) from notification settings.",
    },
  },
  {
    heading: { bn: "তথ্য মুছে ফেলা", en: "Deleting your data" },
    body: {
      bn: "অ্যাকাউন্ট ডিলিট করলে তোমার প্রোফাইল, চ্যাট, রিভিউ, ফেভারিট আর নোটিফিকেশন স্থায়ীভাবে মুছে যায়। বুকিং হিস্ট্রি দোকানের আয়ের হিসাবের অংশ হওয়ায় শুধু সংক্ষিপ্ত আকারে (নাম-ফোন ছাড়া) থেকে যেতে পারে।",
      en: "Deleting your account permanently removes your profile, chats, reviews, favorites, and notifications. Since booking history is part of a shop's income records, a stripped-down version (without your name/phone) may remain.",
    },
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: { bn: "অ্যাকাউন্ট", en: "Account" },
    body: {
      bn: "সঠিক নাম ও ফোন নম্বর দিয়ে অ্যাকাউন্ট খুলতে হবে। একটা অ্যাকাউন্ট একজনের ব্যবহারের জন্য — পাসওয়ার্ড অন্য কারো সাথে শেয়ার করা যাবে না।",
      en: "You must open an account with your real name and phone number. One account is for one person's use — don't share your password with anyone.",
    },
  },
  {
    heading: { bn: "বুকিং", en: "Booking" },
    body: {
      bn: "একবারে একটাই চলমান সিরিয়াল রাখা যায়। বারবার বুক করে না আসা (no-show) দোকানদারকে সমস্যায় ফেলে — বারবার হলে দোকানদার তোমার বুকিং বন্ধ করে দিতে পারে।",
      en: "You can only hold one active serial at a time. Repeatedly booking and not showing up causes problems for shop owners — if it keeps happening, a shop owner may block your bookings.",
    },
  },
  {
    heading: { bn: "পেমেন্ট", en: "Payment" },
    body: {
      bn: "সার্ভিসের দাম দোকান নির্ধারণ করে। বাকি রাখা টাকা পরিশোধের দায়িত্ব কাস্টমারের — বকেয়া থাকলে দোকান রিমাইন্ডার পাঠাতে পারে।",
      en: "The shop sets the service price. Paying any outstanding balance is the customer's responsibility — the shop may send reminders for unpaid dues.",
    },
  },
  {
    heading: { bn: "রিভিউ", en: "Reviews" },
    body: {
      bn: "শুধু সত্যিকারের অভিজ্ঞতা থেকে রিভিউ দিতে হবে। মিথ্যা, আপত্তিকর বা গালিগালাজ-সম্বলিত রিভিউ সরিয়ে ফেলা হতে পারে।",
      en: "Reviews must reflect a genuine experience. False, offensive, or abusive reviews may be removed.",
    },
  },
  {
    heading: { bn: "সেবার পরিবর্তন", en: "Changes to the service" },
    body: {
      bn: "অ্যাপের ফিচার সময়ে সময়ে যোগ, পরিবর্তন বা বন্ধ করা হতে পারে — চেষ্টা থাকবে বড় কোনো পরিবর্তনের আগে জানানোর।",
      en: "App features may be added, changed, or removed over time — we'll try to notify you before any major change.",
    },
  },
];

export const CANCELLATION_SECTIONS: LegalSection[] = [
  {
    heading: { bn: "কাস্টমার নিজে বাতিল করলে", en: "If you cancel it yourself" },
    body: {
      bn: 'সার্ভিস শুরু হওয়ার আগ পর্যন্ত "আমার সিরিয়াল" পেজ থেকে বিনামূল্যে বাতিল করা যায়। অগ্রিম টাকা দেওয়া থাকলে সেটা দোকানের সাথে সরাসরি বুঝে নিতে হবে — অ্যাপে এখনো রিফান্ড অটোমেশন নেই।',
      en: 'You can cancel for free from the "My bookings" page any time before service starts. If you paid an advance, you\'ll need to settle it directly with the shop — the app doesn\'t automate refunds yet.',
    },
  },
  {
    heading: { bn: "দোকান বাতিল করলে", en: "If the shop cancels it" },
    body: {
      bn: "দোকান বন্ধ থাকলে বা কোনো কারণে সার্ভিস দিতে না পারলে দোকানদার সিরিয়াল বাতিল করতে পারে — বাতিল হলে সাথে সাথে নোটিফিকেশন যায়।",
      en: "If the shop is closed or can't provide the service for some reason, the owner may cancel your serial — you'll get a notification right away.",
    },
  },
  {
    heading: { bn: "No-show", en: "No-show" },
    body: {
      bn: 'সিরিয়াল এলেও কাস্টমার উপস্থিত না থাকলে দোকানদার সেটাকে "no-show" মার্ক করতে পারে। বারবার no-show হলে ভবিষ্যতে বুকিং নিতে সমস্যা হতে পারে।',
      en: 'If your serial comes up but you\'re not present, the shop owner may mark it a "no-show." Repeated no-shows can cause trouble booking in the future.',
    },
  },
  {
    heading: { bn: "বাকি টাকা", en: "Outstanding balance" },
    body: {
      bn: 'সার্ভিস শেষে বাকি রেখে গেলে সেটা "বাকির খাতা"-এ জমা থাকে, বাতিল হয় না — কাস্টমারের কাছ থেকে পরে আদায় করার দায়িত্ব দোকানদারের।',
      en: 'If you leave a balance due after service, it\'s recorded in the "due ledger," not cancelled — collecting it later is the shop owner\'s responsibility.',
    },
  },
];
