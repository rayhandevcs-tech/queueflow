import {
  CircleDot,
  Home,
  MessageCircle,
  Receipt,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export const CUSTOMER_NAV_ITEMS: ReadonlyArray<{
  href: string;
  icon: LucideIcon;
  label: { bn: string; en: string };
}> = [
  { href: "/explore", icon: Home, label: { bn: "হোম", en: "Home" } },
  { href: "/my-serial", icon: CircleDot, label: { bn: "সিরিয়াল", en: "Serial" } },
  { href: "/chats", icon: MessageCircle, label: { bn: "মেসেজ", en: "Messages" } },
  { href: "/transactions", icon: Receipt, label: { bn: "লেনদেন", en: "Payments" } },
  { href: "/profile", icon: UserRound, label: { bn: "প্রোফাইল", en: "Profile" } },
] as const;
