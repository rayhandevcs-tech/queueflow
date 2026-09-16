import {
  CalendarCheck,
  CircleDot,
  Crown,
  Home,
  MessageCircle,
  Receipt,
  Share2,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { BookingModel } from "@/lib/business-model";

export interface CustomerNavItem {
  href: string;
  icon: LucideIcon;
  label: { bn: string; en: string };
}

/**
 * The bottom bar. Five is the ceiling — a sixth turns every label into an
 * unreadable sliver on a small phone.
 *
 * The bookings slot is the one that changes shape: a salon customer is
 * looking for their serial in a live queue, a parlour customer for the
 * appointment they booked last week. Same route (`/my-serial` hosts both, and
 * has since Sprint 5), different name and icon, because the label is what
 * tells someone the app understood what they came for.
 */
export function customerNavItems(model: BookingModel): ReadonlyArray<CustomerNavItem> {
  const bookings: CustomerNavItem =
    model === "APPOINTMENT"
      ? {
          href: "/my-serial",
          icon: CalendarCheck,
          label: { bn: "অ্যাপয়েন্টমেন্ট", en: "Appointments" },
        }
      : { href: "/my-serial", icon: CircleDot, label: { bn: "সিরিয়াল", en: "Serial" } };

  return [
    { href: "/explore", icon: Home, label: { bn: "হোম", en: "Home" } },
    bookings,
    { href: "/chats", icon: MessageCircle, label: { bn: "মেসেজ", en: "Messages" } },
    { href: "/transactions", icon: Receipt, label: { bn: "লেনদেন", en: "Payments" } },
    { href: "/profile", icon: UserRound, label: { bn: "প্রোফাইল", en: "Profile" } },
  ];
}

/**
 * Sidebar destinations, on every viewport.
 *
 * The sidebar renders as the desktop column AND as the mobile drawer behind
 * the hamburger, so everything here is reachable on a phone in two taps — it
 * is the app's existing overflow pattern for the things that deserve a
 * permanent home but not one of the five thumb-reach slots.
 *
 * **Membership and Referral joined this list in Sprint 11.** Before, a
 * customer's memberships were a card on `/profile` and their referral code was
 * a tab inside whichever shop's page they happened to open — which meant "how
 * do I share my code" had no answer you could navigate to. Both now have their
 * own route and their own line here.
 */
export const CUSTOMER_SIDEBAR_EXTRA_ITEMS: ReadonlyArray<CustomerNavItem> = [
  { href: "/membership", icon: Crown, label: { bn: "মেম্বারশিপ", en: "Membership" } },
  { href: "/referral", icon: Share2, label: { bn: "রেফারেল", en: "Referral" } },
  { href: "/style", icon: Sparkles, label: { bn: "স্টাইল দেখো", en: "Try a style" } },
] as const;
