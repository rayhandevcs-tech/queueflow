import { translate, type Dict } from "@/lib/i18n";

interface AuthErrorLike {
  message?: string;
  code?: string;
}

const AUTH_ERROR_DICT = {
  already_registered: {
    bn: "এই ইমেইলে অ্যাকাউন্ট আছে — লগইন করো।",
    en: "An account with this email already exists — log in instead.",
  },
  email_not_confirmed: {
    bn: "ইমেইল এখনো কনফার্ম হয়নি — ইনবক্স চেক করো।",
    en: "Your email isn't confirmed yet — check your inbox.",
  },
  invalid_email: {
    bn: "এই ইমেইল ঠিকানাটি সঠিক নয়।",
    en: "This email address isn't valid.",
  },
  invalid_credentials: {
    bn: "ইমেইল বা পাসওয়ার্ড ভুল — আবার চেষ্টা করো।",
    en: "Wrong email or password — try again.",
  },
  same_password: {
    bn: "নতুন পাসওয়ার্ড আগেরটার থেকে আলাদা হতে হবে।",
    en: "The new password must be different from the old one.",
  },
  rate_limit: {
    bn: "একটু পরে আবার চেষ্টা করো — অনেকবার হয়ে গেছে।",
    en: "Try again in a bit — too many attempts.",
  },
  weak_password: {
    bn: "পাসওয়ার্ড দুর্বল — কমপক্ষে ৬ অক্ষর দিয়ে চেষ্টা করো।",
    en: "Password is too weak — use at least 6 characters.",
  },
  generic: {
    bn: "কিছু একটা সমস্যা হয়েছে — আবার চেষ্টা করো।",
    en: "Something went wrong — try again.",
  },
} satisfies Dict;

/** Friendly, language-aware message for the common Supabase Auth failures. */
export function translateAuthError(err: unknown): string {
  const e = err as AuthErrorLike;
  const code = e?.code ?? "";
  const text = (e?.message ?? "").toLowerCase();

  if (code === "user_already_exists" || text.includes("already registered")) {
    return translate(AUTH_ERROR_DICT, "already_registered");
  }
  if (code === "email_not_confirmed" || text.includes("email not confirmed")) {
    return translate(AUTH_ERROR_DICT, "email_not_confirmed");
  }
  if (
    code === "email_address_invalid" ||
    (text.includes("email address") && text.includes("invalid"))
  ) {
    return translate(AUTH_ERROR_DICT, "invalid_email");
  }
  if (code === "invalid_credentials" || text.includes("invalid login credentials")) {
    return translate(AUTH_ERROR_DICT, "invalid_credentials");
  }
  if (
    code === "same_password" ||
    text.includes("should be different from the old password")
  ) {
    return translate(AUTH_ERROR_DICT, "same_password");
  }
  if (code === "over_email_send_rate_limit" || text.includes("rate limit")) {
    return translate(AUTH_ERROR_DICT, "rate_limit");
  }
  if (code === "weak_password" || text.includes("password")) {
    return translate(AUTH_ERROR_DICT, "weak_password");
  }
  return translate(AUTH_ERROR_DICT, "generic");
}
