"use client";

import Link from "next/link";
import { Percent } from "lucide-react";
import type { OfferWithShop } from "../api/offers.api";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

export function OfferCarousel({ offers }: { offers: OfferWithShop[] | undefined }) {
  const t = useT(customerExploreDict);

  if (!offers?.length) return null;

  return (
    <div className="mb-5">
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {offers.map((offer) => (
          <Link
            key={offer.id}
            href={offer.shops ? `/explore/${offer.shops.id}` : "#"}
            className="relative flex w-64 shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl bg-ink p-4 text-white shadow-md"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background: offer.shops?.cover_image_url
                  ? `url(${offer.shops.cover_image_url}) center/cover`
                  : "linear-gradient(135deg, var(--color-accent), transparent)",
              }}
            />
            <div className="relative">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm">
                <Percent className="h-3 w-3" />
                {t("discountOff", offer.discount_pct)}
              </span>
              <p className="mt-2.5 truncate font-display text-base font-bold">{offer.title}</p>
              {offer.description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-white/80">{offer.description}</p>
              )}
            </div>
            <p className="relative mt-3 truncate text-[11px] font-semibold text-white/70">
              {offer.shops?.name ?? t("shopFallback")}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
