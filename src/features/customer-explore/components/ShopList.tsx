"use client";

import Link from "next/link";
import { MapPin, Store, Users } from "lucide-react";
import { BUSINESS_TYPE_LABEL } from "@/config/constants";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useOpenShops, useQueueCounts } from "../hooks/use-open-shops";

export function ShopList() {
  const { data: shops, isPending } = useOpenShops();
  const { data: queueCounts } = useQueueCounts();

  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-44 animate-pulse rounded-2xl border border-line bg-card"
          />
        ))}
      </div>
    );
  }

  if (!shops?.length) {
    return (
      <EmptyState
        icon={<Store className="h-6 w-6" />}
        title="No shops are open right now"
        description="Check back a bit later, or browse the map for locations near you."
      />
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {shops.map((shop) => {
        const queueCount = queueCounts?.[shop.id] ?? 0;
        return (
          <li key={shop.id}>
            <Link href={`/explore/${shop.id}`} className="block">
              <Card hover className="overflow-hidden">
                <div className="relative h-28 w-full bg-soft">
                  {shop.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={shop.cover_image_url}
                      alt={shop.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-muted">
                      <Store className="h-8 w-8" />
                    </div>
                  )}
                  <Badge
                    variant={queueCount === 0 ? "good" : "neutral"}
                    className="absolute right-2 top-2 bg-card/90 shadow-sm backdrop-blur"
                  >
                    <Users className="h-3 w-3" />
                    {queueCount === 0 ? "No wait" : `${queueCount} waiting`}
                  </Badge>
                </div>
                <div className="p-4">
                  <p className="truncate text-sm font-semibold text-ink">
                    {shop.name}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                    <span className="font-medium text-accent">
                      {BUSINESS_TYPE_LABEL[shop.business_type]}
                    </span>
                    {shop.address && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="flex min-w-0 items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{shop.address}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
