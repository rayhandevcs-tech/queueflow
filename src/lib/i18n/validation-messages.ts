import type { Dict } from "./types";

/** Shared zod validation messages, reused across every schema file in the app. */
export const VALIDATION = {
  required_email: { bn: "ইমেইল লিখো", en: "Enter your email" },
  invalid_email: { bn: "সঠিক ইমেইল লিখো", en: "Enter a valid email" },
  password_min_6: { bn: "কমপক্ষে ৬ অক্ষর", en: "At least 6 characters" },
  passwords_dont_match: { bn: "পাসওয়ার্ড মিলছে না", en: "Passwords don't match" },
  current_password_required: {
    bn: "বর্তমান পাসওয়ার্ড লিখো",
    en: "Enter your current password",
  },
  account_type_required: {
    bn: "অ্যাকাউন্টের ধরন বেছে নাও",
    en: "Choose an account type",
  },
  min_chars: {
    bn: (n: number) => `কমপক্ষে ${n} অক্ষর লিখো`,
    en: (n: number) => `At least ${n} characters`,
  },
  max_chars: {
    bn: (n: number) => `সর্বোচ্চ ${n} অক্ষর`,
    en: (n: number) => `Max ${n} characters`,
  },
  max_digits: {
    bn: (n: number) => `সর্বোচ্চ ${n} ডিজিট`,
    en: (n: number) => `Max ${n} digits`,
  },
  phone_digits_only: {
    bn: "শুধু সংখ্যা, +, - ব্যবহার করা যাবে",
    en: "Only digits, +, - allowed",
  },
  invalid_bd_phone: {
    bn: "সঠিক মোবাইল নম্বর লিখো (যেমন ০১৭xxxxxxxx)",
    en: "Enter a valid mobile number (e.g. 017xxxxxxxx)",
  },
  business_type_required: {
    bn: "ব্যবসার ধরন বেছে নাও",
    en: "Choose a business type",
  },
  label_required: { bn: "লেবেল লিখো", en: "Enter a label" },
  invalid_color: { bn: "সঠিক রং বেছে নাও", en: "Not a valid color" },
  commission_range: { bn: "কমিশন ০ থেকে ১০০-এর মধ্যে হতে হবে", en: "Commission must be between 0 and 100" },
  customer_name_required: {
    bn: "কাস্টমারের নাম লিখো",
    en: "Enter the customer's name",
  },
  choose_one_service: {
    bn: "কমপক্ষে একটা সার্ভিস বেছে নাও",
    en: "Choose at least one service",
  },
  max_services: {
    bn: (n: number) => `সর্বোচ্চ ${n}টা সার্ভিস`,
    en: (n: number) => `Max ${n} services`,
  },
  rate_min_0: { bn: "মূল্য ০ বা তার বেশি হতে হবে", en: "Rate must be 0 or more" },
  rate_too_large: { bn: "মূল্য অনেক বড়", en: "Rate is too large" },
  whole_number_required: { bn: "পূর্ণসংখ্যা দাও", en: "Enter a whole number" },
  duration_min_1: { bn: "কমপক্ষে ১ মিনিট", en: "At least 1 minute" },
  duration_max_480: { bn: "সর্বোচ্চ ৪৮০ মিনিট", en: "Max 480 minutes" },
  discount_min_1: { bn: "কমপক্ষে ১%", en: "At least 1%" },
  discount_max_90: { bn: "সর্বোচ্চ ৯০%", en: "Max 90%" },
  valid_until_required: {
    bn: "মেয়াদ শেষের তারিখ দাও",
    en: "Choose an expiry date",
  },
  service_required: { bn: "একটা সার্ভিস বেছে নাও", en: "Choose a service" },
  amount_min_1: { bn: "কমপক্ষে ৳১ লিখো", en: "Enter at least ৳1" },
} satisfies Dict;
