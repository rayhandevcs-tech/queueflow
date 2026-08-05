export interface FaqCategory {
  value: string;
  label: { bn: string; en: string };
}

export interface FaqItem {
  category: string;
  question: { bn: string; en: string };
  answer: { bn: string; en: string };
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  { value: "booking", label: { bn: "বুকিং", en: "Booking" } },
  { value: "queue", label: { bn: "সিরিয়াল", en: "Queue" } },
  { value: "payment", label: { bn: "পেমেন্ট", en: "Payment" } },
  { value: "account", label: { bn: "অ্যাকাউন্ট", en: "Account" } },
  { value: "provider", label: { bn: "দোকানদার", en: "Provider" } },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    category: "booking",
    question: { bn: "কীভাবে সিরিয়াল বুক করবো?", en: "How do I book a serial?" },
    answer: {
      bn: 'দোকান খুঁজে সার্ভিস বেছে নিয়ে "সিরিয়াল নাও" চাপো। একবারে শুধু একটা চলমান সিরিয়াল রাখা যায়, তাই আগের সিরিয়াল শেষ না হলে নতুন করে বুক করা যাবে না।',
      en: 'Find a shop, pick a service, and tap "Take a serial." You can only hold one active serial at a time, so you can\'t book a new one until your current one is done.',
    },
  },
  {
    category: "booking",
    question: { bn: "বুকিং করার পর কি বাতিল করা যায়?", en: "Can I cancel a booking after making it?" },
    answer: {
      bn: 'হ্যাঁ, "আমার সিরিয়াল" পেজ থেকে চলমান বুকিং বাতিল করা যায় — যতক্ষণ না দোকানদার সার্ভিস শুরু করে দিয়েছে।',
      en: 'Yes — you can cancel an active booking from the "My bookings" page, as long as the shop owner hasn\'t already started your service.',
    },
  },
  {
    category: "queue",
    question: { bn: "আমার সিরিয়াল আসতে কতক্ষণ লাগবে?", en: "How long until my serial comes up?" },
    answer: {
      bn: "লাইভ ট্র্যাকিং পেজে আনুমানিক অপেক্ষার সময় দেখানো হয় — আগের সবার সার্ভিসের সময় যোগ করে হিসাব করা হয়, তাই দোকানের গতির সাথে সাথে এটা বদলাতে থাকে।",
      en: "The live tracking page shows an estimated wait time — calculated by adding up everyone ahead of you, so it keeps updating as the shop moves along.",
    },
  },
  {
    category: "queue",
    question: {
      bn: '"এখন তোমার পালা" নোটিফিকেশন না পেলে কী করবো?',
      en: 'What if I don\'t get the "your turn" notification?',
    },
    answer: {
      bn: "লাইভ ট্র্যাকিং পেজেই সবচেয়ে নির্ভরযোগ্য আপডেট পাবে — নোটিফিকেশন দেরিতে আসতে পারে নেটওয়ার্কের কারণে, কিন্তু পেজ রিফ্রেশ করলে আসল অবস্থা দেখা যাবে।",
      en: "The live tracking page is always the most reliable update — notifications can be delayed by network issues, but refreshing the page shows the real status.",
    },
  },
  {
    category: "payment",
    question: { bn: "টাকা কখন পরিশোধ করতে হয়?", en: "When do I pay?" },
    answer: {
      bn: 'বেশিরভাগ ক্ষেত্রে সার্ভিস শেষে ক্যাশে পরিশোধ করা হয়। কিছু দোকান বুকিং করার সময় অগ্রিম নেয়। দোকানদার চাইলে বকেয়াও রাখতে পারে — "বাকির খাতা"-এ দেখা যাবে।',
      en: 'Most of the time you pay in cash after the service. Some shops take an advance at booking time. A shop owner can also leave a balance due — you\'ll see it in the "due ledger."',
    },
  },
  {
    category: "payment",
    question: {
      bn: "অনলাইন পেমেন্ট (bKash/Nagad/Rocket/কার্ড) কি চালু আছে?",
      en: "Is online payment (bKash/Nagad/Rocket/Card) available?",
    },
    answer: {
      bn: "ক্যাশ সব দোকানেই চলে। কিছু দোকান হাতে-হাতে কনফার্ম করে bKash/Nagad/Rocket-ও নেয় (দোকানভেদে আলাদা) — কাজ শেষের পেমেন্ট শিটে যেসব অপশন দেখাবে, সেগুলোই ওই দোকান নেয়। কার্ড এখনো কোনো দোকানেই চালু হয়নি।",
      en: "Cash works at every shop. Some shops also accept bKash/Nagad/Rocket with manual confirmation (this varies by shop) — whatever options show up on the job-completion payment sheet are what that shop accepts. Card isn't available anywhere yet.",
    },
  },
  {
    category: "account",
    question: { bn: "প্রোফাইল ছবি বা নাম কীভাবে বদলাবো?", en: "How do I change my profile photo or name?" },
    answer: {
      bn: "অ্যাকাউন্ট পেজে গিয়ে প্রোফাইল তথ্য অংশ থেকে ছবি/নাম/ফোন নম্বর বদলাতে পারবে।",
      en: "Go to the account page and update your photo/name/phone number from the profile information section.",
    },
  },
  {
    category: "account",
    question: { bn: "অ্যাকাউন্ট ডিলিট করলে কী হবে?", en: "What happens if I delete my account?" },
    answer: {
      bn: "তোমার প্রোফাইল, রিভিউ, মেসেজ, ফেভারিট আর নোটিফিকেশন স্থায়ীভাবে মুছে যাবে — এটা ফেরানো যায় না। দোকান থাকলে আগে সাপোর্টে যোগাযোগ করতে হবে।",
      en: "Your profile, reviews, messages, favorites, and notifications are permanently deleted — this can't be undone. If you own a shop, you'll need to contact support first.",
    },
  },
  {
    category: "provider",
    question: {
      bn: "কাস্টমার বাকি রেখে গেলে কীভাবে মনে রাখবো?",
      en: "How do I keep track of a customer who left a balance due?",
    },
    answer: {
      bn: '"বাকির খাতা" পেজে প্রতিটা কাস্টমারের বকেয়ার হিসাব থাকে — সেখান থেকেই রিমাইন্ডার পাঠানো ও টাকা আদায় হওয়ার পর মার্ক করা যায়।',
      en: 'The "due ledger" page tracks every customer\'s outstanding balance — you can send reminders and mark it collected from there.',
    },
  },
  {
    category: "provider",
    question: { bn: "চেয়ার/সার্ভিস কীভাবে যোগ করবো?", en: "How do I add a chair/service?" },
    answer: {
      bn: 'সাইডবার থেকে "চেয়ার" বা "সার্ভিস ও রেট" পেজে গিয়ে নতুন এন্ট্রি যোগ করা যাবে।',
      en: 'Go to the "Chairs" or "Services & rates" page from the sidebar to add a new entry.',
    },
  },
];
