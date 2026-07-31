import { House, MessagesSquare, ReceiptText, TicketCheck, UserRound, type LucideIcon } from "lucide-react";

export type CustomerNavItem = {
  href: string;
  icon: LucideIcon;
  label: { bn: string; en: string };
};

/** প্রাইমারি নেভ — মোবাইল বটম বার + সাইডপ্যানেল দুই জায়গাতেই। */
export const CUSTOMER_NAV_ITEMS: CustomerNavItem[] = [
  { href: "/explore", icon: House, label: { bn: "হোম", en: "Home" } },
  { href: "/my-serial", icon: TicketCheck, label: { bn: "সিরিয়াল", en: "Serial" } },
  { href: "/chats", icon: MessagesSquare, label: { bn: "চ্যাট", en: "Chat" } },
  { href: "/profile", icon: UserRound, label: { bn: "প্রোফাইল", en: "Profile" } },
];

/** শুধু সাইডপ্যানেলে — বটম বারের ৪ স্লটে জায়গা হয় না এমন সেকেন্ডারি ডেস্টিনেশন। */
export const CUSTOMER_SIDEBAR_ITEMS: CustomerNavItem[] = [
  {
    href: "/transactions",
    icon: ReceiptText,
    label: { bn: "লেনদেন ও হিস্টরি", en: "Transactions & history" },
  },
];
