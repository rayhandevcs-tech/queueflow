"use client";

import Link from "next/link";
import { Clock3, MapPin, Sparkles } from "lucide-react";
import { site } from "@/config/site";
import { useT } from "@/lib/i18n";
import { authDict } from "../lib/i18n";

/**
 * The frame around every auth screen, on both sides of the app.
 *
 * The left panel used to be a flat block of brand colour with a headline
 * floating in the middle of it. It now carries three lines of what the product
 * actually does, because this is the only screen someone who hasn't signed up
 * yet ever sees — the one place a value proposition has any work to do.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const t = useT(authDict);

  const POINTS = [
    { icon: MapPin, text: t("authPointNearby") },
    { icon: Clock3, text: t("authPointLeaveOnTime") },
    { icon: Sparkles, text: t("authPointNoQueue") },
  ];

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-accent px-12 py-14 lg:flex lg:flex-col lg:justify-between">
        {/* Soft light sources rather than a flat fill — the panel reads as a
            surface instead of a swatch. */}
        <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -bottom-40 h-[28rem] w-[28rem] rounded-full bg-brass/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:22px_22px]" />

        <span className="relative font-display text-xl font-extrabold tracking-tight text-accent-ink">
          {site.name}
        </span>

        <div className="relative space-y-7">
          <div className="space-y-3.5">
            <h2 className="max-w-md font-display text-[2.6rem] leading-[1.1] font-bold text-accent-ink">
              {site.tagline}
            </h2>
            <p className="max-w-sm text-sm leading-relaxed text-accent-ink/60">
              {t("authTagline")}
            </p>
          </div>

          <ul className="space-y-3">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-accent-ink/85">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-ink/15">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-accent-ink/40">
          &copy; {new Date().getFullYear()} {site.name}
        </p>
      </div>

      <div className="flex items-center justify-center bg-paper px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          {/* Brand mark on mobile only — on desktop the left panel carries it. */}
          <Link
            href="/"
            className="mb-7 flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-ink lg:hidden"
          >
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-accent text-accent-ink">
              <Sparkles className="h-4 w-4" />
            </span>
            {site.name}
          </Link>

          <div className="mb-7">
            <h1 className="font-display text-[1.75rem] leading-tight font-bold tracking-tight text-ink">
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
          </div>

          {children}
        </div>
      </div>
    </main>
  );
}
