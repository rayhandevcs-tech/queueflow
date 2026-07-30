import type { Dict } from "@/lib/i18n";

export const chatDict = {
  chatTitle: { bn: "চ্যাট", en: "Chat" },
  shopNotFound: { bn: "দোকান খুঁজে পাওয়া যায়নি।", en: "Shop not found." },
  customerFallback: { bn: "কাস্টমার", en: "Customer" },
  shopFallback: { bn: "দোকান", en: "Shop" },
  photoPreview: { bn: "📷 ছবি", en: "📷 Photo" },
  noConversationsTitle: { bn: "কোনো কথোপকথন নেই", en: "No conversations yet" },
  noConversationsDesc: {
    bn: "মেসেজ শুরু হলে এখানে দেখাবে।",
    en: "Conversations will show up here once messaging starts.",
  },
  today: { bn: "আজ", en: "Today" },
  yesterday: { bn: "গতকাল", en: "Yesterday" },
  onlineStatus: { bn: "অনলাইন", en: "Online" },
  lastActiveAt: {
    bn: (label: string) => `${label}-এ সক্রিয় ছিল`,
    en: (label: string) => `Active at ${label}`,
  },
  messageSendFailed: { bn: "মেসেজ পাঠানো যায়নি।", en: "Message couldn't be sent." },
  imageSendFailed: { bn: "ছবি পাঠানো যায়নি।", en: "Image couldn't be sent." },
  imageUploadFailed: { bn: "ছবি আপলোড ব্যর্থ হয়েছে।", en: "Image upload failed." },
  messagePlaceholder: { bn: "মেসেজ লেখো…", en: "Write a message…" },
  sendImageTitle: { bn: "ছবি পাঠাও", en: "Send image" },
  sayHello: {
    bn: (name: string) => `${name}-কে হ্যালো বলো`,
    en: (name: string) => `Say hello to ${name}`,
  },
  startConversation: { bn: "কথোপকথন শুরু করো", en: "Start the conversation" },
  chatNotReady: {
    bn: "চ্যাট প্রস্তুত না — আবার চেষ্টা করো।",
    en: "Chat isn't ready — try again.",
  },
  imagesOnlyError: { bn: "শুধু ছবি পাঠানো যাবে", en: "Only images can be sent" },
  imageSizeLimitError: { bn: "ছবি ২ এমবি-র নিচে হতে হবে", en: "Image must be under 2 MB" },
  uploadFailedError: {
    bn: "আপলোড ব্যর্থ হয়েছে — আবার চেষ্টা করো",
    en: "Upload failed — try again",
  },
} satisfies Dict;
