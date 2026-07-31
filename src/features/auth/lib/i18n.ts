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
  phoneLabel: { bn: "মোবাইল নম্বর", en: "Mobile number" },
  businessTypeLabel: { bn: "ব্যবসার ধরন", en: "Business type" },
  salonOption: { bn: "সেলুন", en: "Salon" },
  parlourOption: { bn: "পার্লার", en: "Parlour" },
  confirmPasswordLabel: { bn: "পাসওয়ার্ড কনফার্ম করো", en: "Confirm password" },
  signingUp: { bn: "সাইন আপ হচ্ছে…", en: "Signing up…" },
  signUpCta: { bn: "সাইন আপ", en: "Sign up" },
  haveAccount: { bn: "অ্যাকাউন্ট আছে?", en: "Already have an account?" },
  logIn: { bn: "লগইন করো", en: "Log in" },

  // Verify email (code entry)
  verifyEmailTitle: { bn: "ইমেইল ভেরিফাই করো", en: "Verify your email" },
  verifyEmailSubtitle: {
    bn: "৬-ডিজিট কোডটা লিখে অ্যাকাউন্ট চালু করো",
    en: "Enter the 6-digit code to activate your account",
  },
  verifyEmailCodeSentTo: {
    bn: (email: string) => `কোড পাঠানো হয়েছে ${email}-এ`,
    en: (email: string) => `Code sent to ${email}`,
  },
  verifyCta: { bn: "ভেরিফাই করো", en: "Verify" },
  verifying: { bn: "ভেরিফাই হচ্ছে…", en: "Verifying…" },
  resendCode: { bn: "কোড আবার পাঠাও", en: "Resend code" },
  resendIn: {
    bn: (s: number) => `আবার পাঠাতে পারবে ${s} সেকেন্ড পর`,
    en: (s: number) => `Resend available in ${s}s`,
  },
  codeResent: { bn: "নতুন কোড পাঠানো হয়েছে", en: "A new code has been sent" },
  wrongEmailGoBack: { bn: "ইমেইল ভুল? আবার সাইন আপ করো", en: "Wrong email? Sign up again" },
  emailNotConfirmedVerifyLink: {
    bn: "এখনো ভেরিফাই করোনি? কোড দিয়ে ভেরিফাই করো",
    en: "Haven't verified yet? Verify with your code",
  },

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
