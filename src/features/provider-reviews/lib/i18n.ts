import type { Dict } from "@/lib/i18n";

export const providerReviewsDict = {
  customerReviewsTitle: { bn: "কাস্টমার রিভিউ", en: "Customer reviews" },
  noReviewsTitle: { bn: "এখনো কোনো রিভিউ আসেনি", en: "No reviews yet" },
  noReviewsDesc: {
    bn: "কাস্টমাররা সিরিয়াল শেষে রিভিউ দিলে এখানে দেখাবে।",
    en: "Customer reviews will show up here after they're submitted.",
  },
  reviewCountSuffix: { bn: (n: number) => `${n} রিভিউ`, en: (n: number) => `${n} reviews` },
  latestFilter: { bn: "সর্বশেষ", en: "Latest" },
  withImagesFilter: { bn: "ছবিসহ", en: "With photos" },
  noImageReviewsTitle: { bn: "ছবিসহ কোনো রিভিউ নেই", en: "No reviews with photos" },
  noImageReviewsDesc: {
    bn: "এখনো কেউ ছবি সহ রিভিউ দেয়নি।",
    en: "No one has left a review with photos yet.",
  },
  customerFallback: { bn: "কাস্টমার", en: "Customer" },
  verifiedTitle: {
    bn: "সার্ভিস নেওয়া কাস্টমারের যাচাইকৃত রিভিউ",
    en: "Verified review from a customer who used the service",
  },
  verifiedBadge: { bn: "যাচাইকৃত", en: "Verified" },
  hiddenBadge: { bn: "লুকানো", en: "Hidden" },
  hiddenTitle: {
    bn: "মডারেশনে লুকানো — কাস্টমাররা এটি দেখতে পাচ্ছে না, রেটিং গড়েও ধরা হয়নি",
    en: "Hidden by moderation — customers can't see it and it's out of the rating average",
  },
} satisfies Dict;
