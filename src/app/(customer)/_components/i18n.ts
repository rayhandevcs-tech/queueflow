import type { Dict } from "@/lib/i18n";

export const customerShellDict = {
  customerFallback: { bn: "কাস্টমার", en: "Customer" },
  accountSettings: { bn: "অ্যাকাউন্ট ও সেটিংস", en: "Account & settings" },
  logout: { bn: "লগ-আউট", en: "Log out" },
  openMenu: { bn: "মেনু খোলো", en: "Open menu" },
  closeMenu: { bn: "মেনু বন্ধ করো", en: "Close menu" },
  languageToggleAria: { bn: "ভাষা বদলাও", en: "Switch language" },
  guestLogin: { bn: "লগইন", en: "Log in" },
  guestNavExplore: { bn: "এক্সপ্লোর", en: "Explore" },
  guestNavAbout: { bn: "আমাদের সম্পর্কে", en: "About" },
  guestNavHelp: { bn: "সাহায্য", en: "Help" },
  guestFooterNote: {
    bn: "সিরিয়াল নিতে অ্যাকাউন্ট লাগবে — এক মিনিটের কাজ।",
    en: "You need an account to take a serial — it takes a minute.",
  },
  guestSignUp: { bn: "সাইন আপ", en: "Sign up" },
} satisfies Dict;
