"use client";

import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n";
import { customerStyleDict } from "../lib/i18n";

/**
 * The way into the style studio from the home screen.
 *
 * It lives here rather than in the bottom navigation because that bar already
 * carries five items, and a sixth on a small phone turns every label into an
 * unreadable sliver. A banner also gets to explain itself, which a 10px icon
 * label cannot.
 */
export function StyleStudioBanner() {
  const t = useT(customerStyleDict);

  return (
    <Link
      href="/style"
      className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/[0.06] p-3.5 transition-colors hover:border-accent/60"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
        <Sparkles className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-ink">{t("pageTitle")}</span>
        <span className="block truncate text-[11px] text-muted">{t("pageSubtitle")}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
    </Link>
  );
}
