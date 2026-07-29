"use client";

import { useState } from "react";
import { Images, X } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useShopGallery } from "../hooks/use-shop-detail";

export function GalleryTab({ shopId }: { shopId: string }) {
  const { data: images, isPending } = useShopGallery(shopId);
  const [preview, setPreview] = useState<string | null>(null);

  if (isPending) {
    return (
      <div className="grid min-h-32 place-items-center">
        <Spinner className="h-5 w-5 text-muted" />
      </div>
    );
  }

  if (!images?.length) {
    return (
      <EmptyState
        icon={<Images className="h-6 w-6" />}
        title="কোনো ছবি নেই"
        description="এই দোকান এখনো গ্যালারিতে কোনো ছবি যোগ করেনি।"
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {images.map((img) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setPreview(img.url)}
            className="aspect-square overflow-hidden rounded-xl bg-soft"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-1200 grid place-items-center bg-black/85 p-4"
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </>
  );
}
