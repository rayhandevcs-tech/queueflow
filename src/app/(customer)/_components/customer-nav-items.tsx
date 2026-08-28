import {
  CircleDot,
  Home,
  MessageCircle,
  Receipt,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export interface CustomerNavItem {
  href: string;
  icon: LucideIcon;
  label: { bn: string; en: string };
}

/** The bottom bar. Five is the ceiling — a sixth turns every label into an
 *  unreadable sliver on a small phone. */
export const CUSTOMER_NAV_ITEMS: ReadonlyArray<CustomerNavItem> = [
  { href: "/explore", icon: Home, label: { bn: "হোম", en: "Home" } },
  { href: "/my-serial", icon: CircleDot, label: { bn: "সিরিয়াল", en: "Serial" } },
  { href: "/chats", icon: MessageCircle, label: { bn: "মেসেজ", en: "Messages" } },
  { href: "/transactions", icon: Receipt, label: { bn: "লেনদেন", en: "Payments" } },
  { href: "/profile", icon: UserRound, label: { bn: "প্রোফাইল", en: "Profile" } },
] as const;

/**
 * Sidebar-only destinations.
 *
 * The sidebar has room the bottom bar does not, so things that deserve a
 * permanent home but not one of the five thumb-reach slots live here.
 */
export const CUSTOMER_SIDEBAR_EXTRA_ITEMS: ReadonlyArray<CustomerNavItem> = [
  { href: "/style", icon: Sparkles, label: { bn: "স্টাইল দেখো", en: "Try a style" } },
] as const;
