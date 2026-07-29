"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { useShopGallery, useShopGalleryMutations } from "../hooks/use-shop-gallery";

export function GalleryManager({ shopId }: { shopId: string }) {
  const { data: images } = useShopGallery(shopId);
  const { upload, remove } = useShopGalleryMutations(shopId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync(file);
      } catch (e) {
        setError(e instanceof Error ? e.message : "আপলোড ব্যর্থ হয়েছে");
      }
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-ink">গ্যালারি</span>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images?.map((img) => (
          <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl bg-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove.mutate(img)}
              className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="relative grid aspect-square place-items-center rounded-xl border-2 border-dashed border-line bg-soft text-muted transition-colors hover:border-accent/50 hover:bg-accent/5"
        >
          {upload.isPending ? (
            <Spinner className="h-5 w-5 text-ink" />
          ) : (
            <ImagePlus className="h-6 w-6" />
          )}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {error && <p className="text-xs text-live">{error}</p>}
    </div>
  );
}
