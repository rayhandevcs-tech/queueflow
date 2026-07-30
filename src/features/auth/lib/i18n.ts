import type { Dict } from "@/lib/i18n";

export const authDict = {
  // AuthShell
  authTagline: {
    bn: "আশেপাশের সেলুন ও পার্লারের লাইভ সিরিয়াল দেখুন, বাসা থেকেই বুক করুন — ম্যাপ, সিরিয়াল নম্বর, এস্টিমেটেড টাইম, সব এক জায়গায়।",
    en: "See live serials at nearby salons and parlours, book from home — map, serial number, estimated time, all in one place.",
  },

  // Login
  loginTitle: { bn: "আবার স্বাগতম", en: "Welcome back" },
  loginSubtitle: {
    bn: (siteName: string) => `${siteName}-এ লগইন করো`,
    en: (siteName: string) => `Log in to ${siteName}`,
  },
  resetSuccess: {
    bn: "পাসওয়ার্ড বদলানো হয়েছে — নতুন পাসওয়ার্ড দিয়ে লগইন করো।",
    en: "Password changed — log in with your new password.",
  },
  emailLabel: { bn: "ইমেইল", en: "Email" },
  passwordLabel: { bn: "পাসওয়ার্ড", en: "Password" },
  forgotPassword: { bn: "পাসওয়ার্ড ভুলে গেছো?", en: "Forgot password?" },
  loggingIn: { bn: "লগইন হচ্ছে…", en: "Logging in…" },
  login: { bn: "লগইন", en: "Log in" },
  noAccount: { bn: "অ্যাকাউন্ট নেই?", en: "Don't have an account?" },
  signUp: { bn: "সাইন আপ করো", en: "Sign up" },

  // Register
  registerTitle: { bn: "অ্যাকাউন্ট তৈরি করো", en: "Create an account" },
  registerSubtitle: {
    bn: (siteName: string) => `মিনিটেই ${siteName}-এ যোগ দাও`,
    en: (siteName: string) => `Join ${siteName} in minutes`,
  },
  accountTypeLabel: { bn: "অ্যাকাউন্টের ধরন", en: "Account type" },
  customerOption: { bn: "কাস্টমার", en: "Customer" },
  providerOption: { bn: "দোকানদার", en: "Provider" },
  fullNameLabel: { bn: "নাম", en: "Name" },
  fullNamePlaceholder: { bn: "তোমার পূর্ণ নাম", en: "Your full name" },
  confirmPasswordLabel: { bn: "পাসওয়ার্ড কনফার্ম করো", en: "Confirm password" },
  signingUp: { bn: "সাইন আপ হচ্ছে…", en: "Signing up…" },
  signUpCta: { bn: "সাইন আপ", en: "Sign up" },
  haveAccount: { bn: "অ্যাকাউন্ট আছে?", en: "Already have an account?" },
  logIn: { bn: "লগইন করো", en: "Log in" },
  confirmEmailSent: {
    bn: (email: string) =>
      `${email}-এ কনফার্মেশন লিংক পাঠানো হয়েছে। ইনবক্স চেক করে লিংকে ক্লিক করো, তারপর লগইন করতে পারবে।`,
    en: (email: string) =>
      `A confirmation link has been sent to ${email}. Check your inbox and click the link, then you can log in.`,
  },
  goToLogin: { bn: "লগইনে যাও", en: "Go to login" },

  // Forgot password
  forgotTitle: { bn: "পাসওয়ার্ড ভুলে গেছো?", en: "Forgot your password?" },
  forgotSubtitle: {
    bn: "তোমার ইমেইলে একটা রিসেট লিংক পাঠাবো",
    en: "We'll send a reset link to your email",
  },
  resetEmailSent: {
    bn: (email: string) => `${email}-এ পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে। ইনবক্স চেক করো।`,
    en: (email: string) => `A password reset link has been sent to ${email}. Check your inbox.`,
  },
  backToLogin: { bn: "লগইনে ফিরে যাও", en: "Back to login" },
  sendResetLink: { bn: "রিসেট লিংক পাঠাও", en: "Send reset link" },
  sending: { bn: "পাঠানো হচ্ছে…", en: "Sending…" },
  rememberedPassword: { bn: "পাসওয়ার্ড মনে পড়েছে?", en: "Remembered your password?" },

  // Reset password
  resetTitle: { bn: "নতুন পাসওয়ার্ড সেট করো", en: "Set a new password" },
  resetSubtitle: { bn: "একবারই সেট করলেই হবে", en: "Just set it once" },
  newPasswordLabel: { bn: "নতুন পাসওয়ার্ড", en: "New password" },
  confirmLabel: { bn: "কনফার্ম করো", en: "Confirm" },
  changingPassword: { bn: "সংরক্ষণ হচ্ছে…", en: "Saving…" },
  changePasswordCta: { bn: "পাসওয়ার্ড বদলাও", en: "Change password" },
} satisfies Dict;
