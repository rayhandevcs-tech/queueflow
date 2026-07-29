interface AuthErrorLike {
  message?: string;
  code?: string;
}

/** Friendly Bangla message for the common Supabase Auth failures. */
export function translateAuthError(err: unknown): string {
  const e = err as AuthErrorLike;
  const code = e?.code ?? "";
  const text = (e?.message ?? "").toLowerCase();

  if (code === "user_already_exists" || text.includes("already registered")) {
    return "এই ইমেইলে অ্যাকাউন্ট আছে — লগইন করো।";
  }
  if (code === "email_not_confirmed" || text.includes("email not confirmed")) {
    return "ইমেইল এখনো কনফার্ম হয়নি — ইনবক্স চেক করো।";
  }
  if (
    code === "email_address_invalid" ||
    (text.includes("email address") && text.includes("invalid"))
  ) {
    return "এই ইমেইল ঠিকানাটি সঠিক নয়।";
  }
  if (code === "invalid_credentials" || text.includes("invalid login credentials")) {
    return "ইমেইল বা পাসওয়ার্ড ভুল — আবার চেষ্টা করো।";
  }
  if (
    code === "same_password" ||
    text.includes("should be different from the old password")
  ) {
    return "নতুন পাসওয়ার্ড আগেরটার থেকে আলাদা হতে হবে।";
  }
  if (code === "over_email_send_rate_limit" || text.includes("rate limit")) {
    return "একটু পরে আবার চেষ্টা করো — অনেকবার হয়ে গেছে।";
  }
  if (code === "weak_password" || text.includes("password")) {
    return "পাসওয়ার্ড দুর্বল — কমপক্ষে ৬ অক্ষর দিয়ে চেষ্টা করো।";
  }
  return "কিছু একটা সমস্যা হয়েছে — আবার চেষ্টা করো।";
}
