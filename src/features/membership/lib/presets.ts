import type { MembershipBenefit } from "@/types";

/**
 * Silver, Gold, Platinum, Diamond — the four default tiers.
 *
 * **Not seeded into any shop by the migration**, on purpose. Decision 36 says
 * a shop that has not built a membership programme shows no membership UI
 * anywhere; seeding four rows into every shop in the country would have
 * created a programme for owners who never asked for one, and then a customer
 * could "join" something the owner had never heard of.
 *
 * So they live here instead, behind one button on the owner's own page. An
 * owner who wants the conventional four gets them in a tap and edits the
 * prices; an owner who wants two tiers of their own writes two.
 *
 * The prices are the deliberately round numbers a Dhaka shop would recognise,
 * meant to be overwritten rather than accepted — which is why the owner lands
 * on the tier list with them editable, not on a "confirm" screen.
 */
export interface TierPreset {
  name: string;
  description: { bn: string; en: string };
  price: number;
  durationDays: number;
  benefits: MembershipBenefit[];
}

export const TIER_PRESETS: readonly TierPreset[] = [
  {
    name: "Silver",
    description: {
      bn: "শুরুর প্যাকেজ — নিয়মিত কাস্টমারদের জন্য ছোট ছাড়",
      en: "The starter — a small discount for regulars",
    },
    price: 500,
    durationDays: 90,
    benefits: [
      { kind: "DISCOUNT", label: "সব সার্ভিসে ৫% ছাড়", value: 5 },
    ],
  },
  {
    name: "Gold",
    description: {
      bn: "সবচেয়ে জনপ্রিয় — ভালো ছাড় আর আগে সময় পাওয়ার সুযোগ",
      en: "The popular one — a real discount and first pick of times",
    },
    price: 1500,
    durationDays: 180,
    benefits: [
      { kind: "DISCOUNT", label: "সব সার্ভিসে ১০% ছাড়", value: 10 },
      { kind: "PRIORITY_BOOKING", label: "সময় বাছাইয়ে অগ্রাধিকার" },
    ],
  },
  {
    name: "Platinum",
    description: {
      bn: "বছরজুড়ে — বড় ছাড়, অগ্রাধিকার আর একটা ফ্রি সার্ভিস",
      en: "A whole year — a bigger discount, priority, and one free service",
    },
    price: 3000,
    durationDays: 365,
    benefits: [
      { kind: "DISCOUNT", label: "সব সার্ভিসে ১৫% ছাড়", value: 15 },
      { kind: "PRIORITY_BOOKING", label: "সময় বাছাইয়ে অগ্রাধিকার" },
      { kind: "FREE_SERVICE", label: "বছরে ১টা সার্ভিস ফ্রি", value: 1 },
    ],
  },
  {
    name: "Diamond",
    description: {
      bn: "সবচেয়ে ওপরের ধাপ — সবচেয়ে বড় ছাড় আর নিয়মিত কমপ্লিমেন্টারি সার্ভিস",
      en: "The top of the ladder — the biggest discount and regular extras",
    },
    price: 6000,
    durationDays: 365,
    benefits: [
      { kind: "DISCOUNT", label: "সব সার্ভিসে ২০% ছাড়", value: 20 },
      { kind: "PRIORITY_BOOKING", label: "সময় বাছাইয়ে অগ্রাধিকার" },
      { kind: "FREE_SERVICE", label: "বছরে ৩টা সার্ভিস ফ্রি", value: 3 },
      { kind: "COMPLIMENTARY", label: "প্রতি ভিজিটে কমপ্লিমেন্টারি চা/কফি" },
    ],
  },
];
