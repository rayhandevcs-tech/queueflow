"use client";

import type { Shop } from "@/types";
import { ShopCarouselCard } from "./ShopCarouselCard";

/**
 * A titled horizontal rail of shop cards, with the scrollbar hidden and edge
 * padding that lets the last card breathe.
 *
 * The scroll-hiding declarations were repeated inline in every rail; one
 * component is how they stay identical.
 */
export function ShopRail({
  title,
  shops,
  ratingByShopId,
  waitMin,
  empty,
}: {
  title: string;
  shops: Shop[];
  ratingByShopId?: Map<string, { avg_rating: number; review_count: number }>;
  waitMin?: Record<string, number>;
  /** Shown instead of the rail when there's nothing to list. */
  empty?: React.ReactNode;
}) {
  if (shops.length === 0 && !empty) return null;

  return (
    <section className="mb-5">
      <p className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">{title}</p>

      {shops.length === 0 ? (
        empty
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {shops.map((shop) => (
            <ShopCarouselCard
              key={shop.id}
              shop={shop}
              rating={ratingByShopId?.get(shop.id)}
              waitMin={waitMin?.[shop.id]}
            />
          ))}
        </div>
      )}
    </section>
  );
}
