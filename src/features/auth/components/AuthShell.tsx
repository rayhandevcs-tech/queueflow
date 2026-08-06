"use client";

import Link from "next/link";
import { Clock3, MapPin, Sparkles, Users } from "lucide-react";
import { site } from "@/config/site";
import { useT } from "@/lib/i18n";
import { authDict } from "../lib/i18n";

/**
 * The frame around every auth screen, on both sides of the app.
 *
 * Two structural fixes over the previous version. The left panel used
 * `justify-between`, which stranded the wordmark at the top and left a hole
 * through the middle; the content is now one centred block with the mark and
 * the copyright pinned as small ornaments. And the right column was a narrow
 * `max-w-sm` floating in a wide field of empty paper — it's wider now, with a
 * type scale that gives the heading somewhere to sit.
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
    { icon: Users, text: t("authPointNoQueue") },
  ];

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden lg:block">
        {/* Layered light rather than a flat fill: a diagonal base, two blurred
            sources, and a fine dot grid to give the surface some tooth. */}
        <div className="absolute inset-0 bg-gradient-to-br from-accent via-accent to-[#c03d47]" />
        <div className="absolute -top-40 -left-32 h-[34rem] w-[34rem] rounded-full bg-white/20 blur-[100px]" />
        <div className="absolute -right-32 -bottom-48 h-[38rem] w-[38rem] rounded-full bg-brass/30 blur-[110px]" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:24px_24px]" />
        {/* A soft vignette keeps the corners from feeling brighter than the middle. */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(120,25,30,0.28)_100%)]" />

        <div className="relative flex h-full flex-col justify-center px-14 py-16 xl:px-20">
          <Link
            href="/"
            className="absolute top-14 left-14 flex items-center gap-2.5 xl:left-20"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-ink/15 text-accent-ink ring-1 ring-accent-ink/20">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-accent-ink">
              {site.name}
            </span>
          </Link>

          <div className="max-w-lg space-y-8">
            <div className="space-y-4">
              <h2 className="font-display text-[2.9rem] leading-[1.08] font-bold tracking-tight text-accent-ink xl:text-[3.25rem]">
                {site.tagline}
              </h2>
              <p className="max-w-md text-[15px] leading-relaxed text-accent-ink/65">
                {t("authTagline")}
              </p>
            </div>

            <ul className="space-y-2.5">
              {POINTS.map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="flex items-center gap-3.5 rounded-2xl bg-accent-ink/[0.09] px-4 py-3 ring-1 ring-accent-ink/10 backdrop-blur-[2px]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-ink/15 text-accent-ink">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-[14px] font-medium text-accent-ink/90">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="absolute bottom-14 left-14 text-xs text-accent-ink/35 xl:left-20">
            &copy; {new Date().getFullYear()} {site.name}
          </p>
        </div>
      </aside>

      <div className="flex items-center justify-center bg-paper px-5 py-12 sm:px-10">
        <div className="w-full max-w-[26rem]">
          {/* Brand mark on mobile only — on desktop the left panel carries it. */}
          <Link
            href="/"
            className="mb-9 inline-flex items-center gap-2.5 lg:hidden"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-ink shadow-sm">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-ink">
              {site.name}
            </span>
          </Link>

          <header className="mb-8">
            <h1 className="font-display text-[2rem] leading-[1.15] font-bold tracking-tight text-ink">
              {title}
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{subtitle}</p>
          </header>

          {children}
        </div>
      </div>
    </main>
  );
}
