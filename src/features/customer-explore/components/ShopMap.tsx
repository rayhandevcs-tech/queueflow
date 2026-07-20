"use client";

import dynamic from "next/dynamic";
import { MapPinOff } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useOpenShops, useQueueCounts } from "../hooks/use-open-shops";

const ShopMapInner = dynamic(() => import("./ShopMapInner"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[440px] w-full place-items-center rounded-2xl border border-line bg-card shadow-sm">
      <Spinner className="h-6 w-6 text-muted" />
    </div>
  ),
});

export function ShopMap() {
  const { data: shops, isPending } = useOpenShops();
  const { data: queueCounts } = useQueueCounts();

  if (isPending) {
    return (
      <div className="grid h-[440px] w-full place-items-center rounded-2xl border border-line bg-card shadow-sm">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  const located = (shops ?? []).filter(
    (s): s is typeof s & { latitude: number; longitude: number } =>
      s.latitude != null && s.longitude != null,
  );

  if (!located.length) {
    return (
      <EmptyState
        icon={<MapPinOff className="h-6 w-6" />}
        title="No shop locations are set yet"
        description="Switch to the list view to see open shops instead."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line shadow-sm">
      <ShopMapInner shops={located} queueCounts={queueCounts ?? {}} />
    </div>
  );
}
