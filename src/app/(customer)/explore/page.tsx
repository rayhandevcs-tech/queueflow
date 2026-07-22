"use client";

import { useMyProfile } from "@/features/account/hooks/use-my-profile";
import {
  useOpenShops,
  useShopLiveStats,
} from "@/features/customer-explore/hooks/use-open-shops";
import { ActiveBookingBanner } from "@/features/customer-booking/components/ActiveBookingBanner";
import { ExploreView } from "@/features/customer-explore/components/ExploreView";
import { AvatarChip } from "@/components/ui/AvatarChip";

export default function ExplorePage() {
  const { data: profile } = useMyProfile();
  const { data: shops, isPending: shopsPending } = useOpenShops();
  const { counts, waitMin, isPending: statsPending } = useShopLiveStats();

  const openShopCount = shops?.length ?? 0;
  const waits = Object.values(waitMin);
  const minWait = waits.length ? Math.min(...waits) : 0;

  return (
    <div className="animate-fade-up">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted">আসসালামু আলাইকুম 👋</p>
          <h1 className="mt-0.5 font-display text-[25px] font-bold leading-tight text-ink">
            কাছের সেলুন
          </h1>
        </div>
        <AvatarChip label={profile?.full_name} />
      </div>

      <ActiveBookingBanner />

      <div className="mb-4 flex gap-2.5">
        <div className="flex-1 rounded-[13px] border border-line bg-soft p-3">
          <p className="font-number text-[19px] font-bold text-ink">{openShopCount}</p>
          <p className="text-[11px] text-muted">খোলা দোকান</p>
        </div>
        <div className="flex-1 rounded-[13px] border border-line bg-soft p-3">
          <p className="font-number text-[19px] font-bold text-ink">
            ~{minWait}
            <span className="text-xs">মিন</span>
          </p>
          <p className="text-[11px] text-muted">সবচেয়ে কম ওয়েট</p>
        </div>
      </div>

      <p className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">
        আশেপাশের দোকান
      </p>

      <ExploreView
        shops={shops}
        counts={counts}
        waitMin={waitMin}
        isPending={shopsPending || statsPending}
      />
    </div>
  );
}
