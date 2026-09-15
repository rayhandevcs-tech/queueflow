"use client";

import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatBanglaDate, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { useMyLoyaltyCards } from "../hooks/use-loyalty";
import { loyaltyDict } from "../lib/i18n";

/**
 * The customer's point cards, on their existing profile page.
 *
 * **One card per shop, never a total** — decision 33, and the single most
 * important thing about this component. Fifty points buys something at the
 * shop that gave them and nothing anywhere else, so a combined figure would
 * be an actively misleading number. Every card therefore carries its shop's
 * name and logo, so "where do I spend this" is never a question.
 *
 * Renders nothing at all for a customer with no points. There is no action to
 * offer from here — points arrive by being served, not by tapping anything —
 * so an empty section would be pure noise on a busy page.
 */
export function MyLoyaltyCards() {
  const t = useT(loyaltyDict);
  const { data: cards } = useMyLoyaltyCards();

  if (!cards || cards.length === 0) return null;

  const num = (n: number) => toBanglaDigits(n);

  return (
    <section className="space-y-2.5">
      <div>
        <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">
          {t("profileHeading")}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted">{t("profileIntro")}</p>
      </div>

      <ul className="space-y-2.5">
        {cards.map((card) => (
          <li key={card.shopId}>
            <Link
              href={`/explore/${card.shopId}`}
              className={cn(
                "flex items-center gap-3 rounded-2xl border bg-card p-3.5 transition-colors hover:bg-soft",
                card.isEnabled ? "border-accent/35" : "border-line",
              )}
            >
              <AvatarChip label={card.shopName} avatarUrl={card.shopLogoUrl} size={40} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{card.shopName}</p>
                <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  <span>{t("cardLifetime", num(card.lifetimeEarned))}</span>
                  <span aria-hidden>·</span>
                  <span>{t("cardRate", num(card.takaPerPoint))}</span>
                </p>
                {card.lastEarnedAt && (
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {t("lastEarnedOn", formatBanglaDate(new Date(card.lastEarnedAt)))}
                  </p>
                )}
                {/* A shop that switched the programme off keeps what it gave.
                    Saying so is kinder than a card that quietly stops moving. */}
                {!card.isEnabled && (
                  <p className="mt-1 text-[11px] leading-snug text-brass">
                    {t("cardPaused")} · {t("cardPausedHint")}
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                <p className="flex items-center justify-end gap-1 font-display text-[22px] leading-none font-bold text-accent">
                  <Sparkles className="h-4 w-4" />
                  {num(card.balance)}
                </p>
                {!card.isEnabled && (
                  <StatusPill
                    tone="neutral"
                    dot={false}
                    label={t("cardPaused")}
                    className="mt-1"
                  />
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>

      <p className="px-1 text-[11px] leading-snug text-muted">{t("notRedeemableYet")}</p>
    </section>
  );
}
