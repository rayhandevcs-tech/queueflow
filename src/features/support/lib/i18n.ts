import type { Dict } from "@/lib/i18n";

export const supportDict = {
  searchPlaceholder: { bn: "প্রশ্ন খুঁজো...", en: "Search questions..." },
  all: { bn: "সব", en: "All" },
  noQuestionsTitle: { bn: "কোনো প্রশ্ন পাওয়া যায়নি", en: "No questions found" },
  noQuestionsDesc: {
    bn: "অন্য শব্দ দিয়ে খুঁজে দেখো, অথবা সরাসরি যোগাযোগ করো।",
    en: "Try different words, or reach out to us directly.",
  },
  directContact: { bn: "সরাসরি যোগাযোগ", en: "Direct contact" },
  whatsappMessage: { bn: "হোয়াটসঅ্যাপে মেসেজ দাও", en: "Message us on WhatsApp" },

  // Page titles (SharedPageShell)
  helpCenterTitle: { bn: "হেল্প সেন্টার", en: "Help center" },
  privacyPolicyTitle: { bn: "গোপনীয়তা নীতি", en: "Privacy policy" },
  privacyIntro: {
    bn: "তোমার তথ্য কীভাবে রাখা ও ব্যবহার করা হয়, তার সংক্ষিপ্ত বিবরণ।",
    en: "A short summary of how your information is kept and used.",
  },
  termsTitle: { bn: "ব্যবহারের শর্তাবলী", en: "Terms of use" },
  termsIntro: {
    bn: "এই অ্যাপ ব্যবহার করার আগে নিচের শর্তগুলো পড়ে নাও।",
    en: "Please read these terms before using the app.",
  },
  cancellationPolicyTitle: { bn: "বাতিল নীতি", en: "Cancellation policy" },
  notificationSettingsTitle: { bn: "নোটিফিকেশন সেটিংস", en: "Notification settings" },

  // ---- Tickets ----
  supportTitle: { bn: "সাহায্য ও সাপোর্ট", en: "Help and support" },
  tabFaq: { bn: "সাধারণ প্রশ্ন", en: "FAQ" },
  tabTickets: { bn: "আমার অভিযোগ", en: "My requests" },
  newTicket: { bn: "সমস্যা জানাও", en: "Report a problem" },
  newTicketTitle: { bn: "নতুন অভিযোগ", en: "New request" },
  newTicketHint: {
    bn: "সমস্যাটা যত পরিষ্কার করে লিখবে, তত দ্রুত সমাধান দিতে পারবো।",
    en: "The clearer you describe it, the faster we can help.",
  },
  categoryLabel: { bn: "কোন বিষয়ে?", en: "What is it about?" },
  subjectLabel: { bn: "সংক্ষেপে বিষয়", en: "Subject" },
  subjectPlaceholder: { bn: "যেমন: সিরিয়াল বাতিল হচ্ছে না", en: "e.g. Cannot cancel my serial" },
  bodyLabel: { bn: "বিস্তারিত লেখো", en: "Describe the problem" },
  bodyPlaceholder: {
    bn: "কী হয়েছে, কখন হয়েছে, কোন দোকানে — যা যা মনে আছে লিখে দাও।",
    en: "What happened, when, and at which shop — anything you remember helps.",
  },
  screenshotLabel: { bn: "স্ক্রিনশট (ঐচ্ছিক)", en: "Screenshot (optional)" },
  addScreenshot: { bn: "ছবি যোগ করো", en: "Add an image" },
  removeImage: { bn: "ছবি সরাও", en: "Remove image" },
  submitTicket: { bn: "পাঠাও", en: "Submit" },
  submitting: { bn: "পাঠানো হচ্ছে...", en: "Sending..." },
  ticketSubmitted: { bn: "অভিযোগ জমা হয়েছে", en: "Your request was submitted" },
  noTicketsTitle: { bn: "কোনো অভিযোগ নেই", en: "No requests yet" },
  noTicketsDesc: {
    bn: "কোথাও আটকে গেলে এখান থেকে জানাও, আমরা দেখে উত্তর দেবো।",
    en: "If anything goes wrong, tell us here and we'll get back to you.",
  },
  ticketNotFound: { bn: "অভিযোগটি খুঁজে পাওয়া যায়নি", en: "Request not found" },
  replyPlaceholder: { bn: "আরও কিছু বলার আছে?", en: "Anything else to add?" },
  sendReply: { bn: "উত্তর পাঠাও", en: "Send" },
  closedNotice: {
    bn: "এই অভিযোগটি বন্ধ করা হয়েছে। নতুন কিছু হলে নতুন অভিযোগ করো।",
    en: "This request is closed. Please open a new one if something else comes up.",
  },
  youLabel: { bn: "তুমি", en: "You" },
  supportTeamLabel: { bn: "সাপোর্ট টিম", en: "Support team" },
  unreadReply: { bn: "নতুন উত্তর", en: "New reply" },
  openedOn: { bn: "খোলা হয়েছে", en: "Opened" },
  imagesOnlyError: { bn: "শুধু ছবি দেওয়া যাবে।", en: "Images only." },
  imageSizeLimitError: {
    bn: "ছবিটা অনেক বড় — ৪০ এমবি-র কম হতে হবে।",
    en: "That image is too large — it must be under 40 MB.",
  },
  tooManyImagesError: { bn: "সর্বোচ্চ ৩টি ছবি দেওয়া যাবে।", en: "Up to 3 images." },
  uploadFailedError: { bn: "ছবি আপলোড করা যায়নি।", en: "Could not upload the image." },
} satisfies Dict;
