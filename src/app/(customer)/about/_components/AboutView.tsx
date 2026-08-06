"use client";

import Link from "next/link";
import {
  Clock3,
  LifeBuoy,
  Mail,
  MapPin,
  MessageCircle,
  Store,
  Ticket,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { site } from "@/config/site";
import { useAuthGate } from "@/components/auth/AuthGate";
import { useT, type Dict } from "@/lib/i18n";

const dict = {
  title: { bn: "SmartSailor কী?", en: "What is SmartSailor?" },
  lede: {
    bn: "সেলুন আর পার্লারে গিয়ে বসে থাকার দিন শেষ। আশেপাশের দোকানের লাইভ সিরিয়াল দেখো, ফোন থেকেই সিরিয়াল নাও, আর কখন রওনা দিতে হবে সেটা আমরা জানিয়ে দেবো।",
    en: "No more sitting around at the salon. See live queues at nearby shops, take a serial from your phone, and we'll tell you when to set out.",
  },

  howTitle: { bn: "কীভাবে কাজ করে", en: "How it works" },
  step1Title: { bn: "দোকান খুঁজে নাও", en: "Find a shop" },
  step1Body: {
    bn: "ম্যাপে বা তালিকায় আশেপাশের দোকান, তাদের সার্ভিস, দাম আর রেটিং দেখো — অ্যাকাউন্ট ছাড়াই।",
    en: "Browse nearby shops on the map or in the list — services, prices and ratings, without an account.",
  },
  step2Title: { bn: "লাইভ সিরিয়াল দেখো", en: "See the live queue" },
  step2Body: {
    bn: "কতজন অপেক্ষায় আছে আর আনুমানিক কত সময় লাগবে, সেটা সরাসরি দোকানের কাউন্টার থেকেই আসে।",
    en: "How many are waiting and roughly how long it takes, straight from the shop's own counter.",
  },
  step3Title: { bn: "সিরিয়াল নাও", en: "Take a serial" },
  step3Body: {
    bn: "পছন্দের সার্ভিস বেছে সিরিয়াল নাও। এই ধাপে একটা অ্যাকাউন্ট লাগবে — যাতে তোমার সিরিয়ালটা তোমারই থাকে।",
    en: "Pick your services and take a serial. This step needs an account, so the serial is actually yours.",
  },
  step4Title: { bn: "সময়মতো রওনা দাও", en: "Leave at the right time" },
  step4Body: {
    bn: "তোমার পালা কাছে এলে জানিয়ে দেবো — লাইনে দাঁড়িয়ে থাকতে হবে না।",
    en: "We'll tell you when your turn is close — no standing in line.",
  },

  guestTitle: { bn: "অ্যাকাউন্ট ছাড়া কী কী করা যায়", en: "What you can do without an account" },
  guestYes: {
    bn: "দোকান, ম্যাপ, সার্ভিস, দাম, ছবি, রেটিং, রিভিউ আর লাইভ কিউ — সবই দেখা যায়।",
    en: "Shops, the map, services, prices, photos, ratings, reviews and the live queue — all viewable.",
  },
  guestNo: {
    bn: "সিরিয়াল নেওয়া, ফেভারিট করা, দোকানের সাথে চ্যাট আর রিভিউ লেখার জন্য অ্যাকাউন্ট লাগবে।",
    en: "Taking a serial, favouriting, messaging a shop and writing a review need an account.",
  },

  helpTitle: { bn: "সাহায্য ও সাপোর্ট", en: "Help & support" },
  helpSignedOut: {
    bn: "সমস্যা হলে আমাদের মেইল করো, অথবা অ্যাকাউন্ট খুলে সরাসরি সাপোর্ট টিকিট খোলো — টিকিটের উত্তর অ্যাপেই পাবে।",
    en: "Email us if something is wrong, or open an account and raise a support ticket — replies land in the app.",
  },
  helpSignedIn: {
    bn: "কোনো সমস্যা হলে সাপোর্ট টিকিট খোলো — আমরা অ্যাপেই উত্তর দেবো।",
    en: "Something wrong? Open a support ticket — we'll reply right here in the app.",
  },
  openTicket: { bn: "সাপোর্টে যাও", en: "Go to support" },
  createAccount: { bn: "অ্যাকাউন্ট খোলো", en: "Create an account" },
  mailUs: { bn: "মেইল করো", en: "Email us" },

  shopOwnerTitle: { bn: "দোকান চালাও?", en: "Run a shop?" },
  shopOwnerBody: {
    bn: "দোকানদার হিসেবে রেজিস্টার করলে কিউ বোর্ড, স্টাফ, সার্ভিস, ইনকামের হিসাব আর কাউন্টার ডিসপ্লে — সবই পাবে।",
    en: "Register as a shop and you get the queue board, staff, services, income tracking and the counter display.",
  },
  shopOwnerCta: { bn: "দোকান হিসেবে যোগ দাও", en: "Join as a shop" },
} satisfies Dict;

const STEPS = [
  { icon: MapPin, title: "step1Title", body: "step1Body" },
  { icon: Clock3, title: "step2Title", body: "step2Body" },
  { icon: Ticket, title: "step3Title", body: "step3Body" },
  { icon: MessageCircle, title: "step4Title", body: "step4Body" },
] as const;

/**
 * The public explainer, and the one place a guest can reach for help.
 *
 * /help is the ticket system and needs an account, so pointing a signed-out
 * visitor at it would just bounce them to a login form — the page-based
 * gatekeeping this whole flow moves away from. The help section lives here
 * instead, with an email address that works for anyone, and links on to the
 * ticket system for people who do have an account.
 */
export function AboutView() {
  const t = useT(dict);
  const { signedIn } = useAuthGate();

  return (
    <div className="animate-fade-up space-y-6">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold text-ink">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t("lede")}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">
          {t("howTitle")}
        </h2>
        <ol className="space-y-2.5">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <Card className="flex items-start gap-3.5 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-accent/10 text-accent">
                  <step.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-[15px] font-bold text-ink">
                    <span className="mr-1.5 font-number text-muted">{index + 1}.</span>
                    {t(step.title)}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{t(step.body)}</p>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">
          {t("guestTitle")}
        </h2>
        <Card tone="soft" className="space-y-2.5 p-4">
          <p className="text-[13px] leading-relaxed text-ink">✅ {t("guestYes")}</p>
          <p className="text-[13px] leading-relaxed text-muted">🔒 {t("guestNo")}</p>
        </Card>
      </section>

      {/* The anchor the guest nav's "সাহায্য" points at. */}
      <section id="help" className="scroll-mt-24 space-y-2.5">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
          <LifeBuoy className="h-4 w-4" />
          {t("helpTitle")}
        </h2>
        <Card className="space-y-3.5 p-4">
          <p className="text-[13px] leading-relaxed text-muted">
            {signedIn ? t("helpSignedIn") : t("helpSignedOut")}
          </p>
          <div className="flex flex-wrap gap-2">
            {signedIn ? (
              <Link
                href="/help"
                className="grid min-h-11 place-items-center rounded-[14px] bg-accent px-4 text-sm font-bold text-accent-ink hover:opacity-90"
              >
                {t("openTicket")}
              </Link>
            ) : (
              <Link
                href="/register"
                className="grid min-h-11 place-items-center rounded-[14px] bg-accent px-4 text-sm font-bold text-accent-ink hover:opacity-90"
              >
                {t("createAccount")}
              </Link>
            )}
            <a
              href={`mailto:${site.supportEmail}`}
              className="grid min-h-11 place-items-center gap-1.5 rounded-[14px] border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-soft"
            >
              <span className="flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                {t("mailUs")}
              </span>
            </a>
          </div>
        </Card>
      </section>

      {!signedIn && (
        <section className="space-y-2.5">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
            <Store className="h-4 w-4" />
            {t("shopOwnerTitle")}
          </h2>
          <Card tone="soft" className="space-y-3.5 p-4">
            <p className="text-[13px] leading-relaxed text-muted">{t("shopOwnerBody")}</p>
            <Link href="/register" className="text-sm font-bold text-accent hover:underline">
              {t("shopOwnerCta")} →
            </Link>
          </Card>
        </section>
      )}
    </div>
  );
}
