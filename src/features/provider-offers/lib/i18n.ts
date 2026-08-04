import type { Dict } from "@/lib/i18n";

export const providerOffersDict = {
  offersTitle: { bn: "অফার", en: "Offers" },
  offersSubtitle: {
    bn: "অফার তৈরি করলে নিয়মিত কাস্টমারদের নোটিফিকেশন যাবে",
    en: "Creating an offer notifies your regular customers",
  },
  newOfferCta: { bn: "নতুন অফার", en: "New offer" },
  noOffersTitle: { bn: "এখনো কোনো অফার তৈরি হয়নি", en: "No offers created yet" },
  noOffersDesc: {
    bn: "প্রথম অফার তৈরি করো, নিয়মিত কাস্টমারদের কাছে পৌঁছে যাবে।",
    en: "Create your first offer to reach your regular customers.",
  },
  discountOffValidUntil: {
    bn: (pct: number, date: string) => `${pct}% ছাড় · মেয়াদ ${date}`,
    en: (pct: number, date: string) => `${pct}% off · valid until ${date}`,
  },
  expiredSuffix: { bn: " (শেষ)", en: " (expired)" },
  offerActiveWord: { bn: "চালু", en: "Active" },
  offerInactiveWord: { bn: "বন্ধ", en: "Inactive" },
  deleteOfferAria: { bn: "অফার মুছো", en: "Delete offer" },
  deleteOfferTitle: { bn: "এই অফারটা মুছে ফেলবে?", en: "Delete this offer?" },
  deleteOfferDesc: {
    bn: "কাস্টমাররা আর এই অফারটা দেখবে না।",
    en: "Customers will no longer see this offer.",
  },
  deleteOfferConfirm: { bn: "মুছে ফেলো", en: "Delete" },

  // OfferForm
  offerNamePlaceholder: { bn: "অফারের নাম (ঈদ স্পেশাল)", en: "Offer name (Eid Special)" },
  descriptionOptionalPlaceholder: { bn: "বিস্তারিত (ঐচ্ছিক)", en: "Details (optional)" },
  discountPctPlaceholder: { bn: "ছাড় (%)", en: "Discount (%)" },
  offerSaving: { bn: "সেভ হচ্ছে…", en: "Saving…" },
  createOffer: { bn: "অফার তৈরি করো", en: "Create offer" },
  offerUpdate: { bn: "আপডেট করো", en: "Update" },
  cancel: { bn: "বাতিল", en: "Cancel" },
} satisfies Dict;
