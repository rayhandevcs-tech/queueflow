"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { compressImage, IMAGE_PRESETS } from "@/lib/image-compress";
import { getBrowserClient } from "@/lib/supabase/client";
import type { ShopSetupDraft } from "../lib/setup-schema";

export type SetupErrorCode =
  | "NO_SHOP"
  | "IMAGE_TOO_LARGE"
  | "REFUSED"
  | "ANTHROPIC_KEY_MISSING"
  | "GENERIC";

export class SetupError extends Error {
  constructor(public code: SetupErrorCode) {
    super(code);
  }
}

async function toBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new SetupError("GENERIC"));
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve({
        data: comma >= 0 ? result.slice(comma + 1) : result,
        mediaType: file.type,
      });
    };
    reader.readAsDataURL(file);
  });
}

export function useGenerateSetup() {
  return useMutation<
    { draft: ShopSetupDraft; benchmarkCount: number },
    SetupError,
    File[]
  >({
    mutationFn: async (files) => {
      // Compressed before upload: three phone photos is easily 20 MB, and none
      // of those bytes tell the model anything the compressed version doesn't.
      const photos = await Promise.all(
        files.map(async (file) => {
          const small = await compressImage(file, IMAGE_PRESETS.attachment);
          const { data, mediaType } = await toBase64(small);
          return {
            data,
            mediaType: ["image/jpeg", "image/png", "image/webp"].includes(mediaType)
              ? mediaType
              : "image/jpeg",
          };
        }),
      );

      const res = await fetch("/api/ai/shop-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        const code = body?.error;
        throw new SetupError(
          code === "NO_SHOP" ||
          code === "IMAGE_TOO_LARGE" ||
          code === "REFUSED" ||
          code === "ANTHROPIC_KEY_MISSING"
            ? code
            : "GENERIC",
        );
      }

      return res.json();
    },
  });
}

/**
 * Write the draft the owner has finished editing.
 *
 * Two separate writes rather than an RPC: the about text belongs to the shop
 * row and the services are their own rows, and both already have working,
 * RLS-checked paths. Adding a transaction-shaped RPC for a one-off setup step
 * would be a third way to write data that has to stay in step with the other
 * two forever.
 */
export function useApplySetup(shopId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draft: ShopSetupDraft) => {
      if (!shopId) throw new SetupError("NO_SHOP");
      const supabase = getBrowserClient();

      if (draft.about.trim()) {
        const { error } = await supabase
          .from("shops")
          .update({ about: draft.about.trim() })
          .eq("id", shopId);
        if (error) throw error;
      }

      if (draft.services.length > 0) {
        const { error } = await supabase.from("services").insert(
          draft.services.map((s) => ({
            shop_id: shopId,
            name: s.nameBn.trim() || s.nameEn.trim(),
            rate: Math.max(0, Math.round(s.rate)),
            default_duration_min: Math.max(1, Math.round(s.durationMin)),
            is_active: true,
          })),
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.services.byShop(shopId ?? "") });
      void queryClient.invalidateQueries({ queryKey: keys.shops.mine() });
      void queryClient.invalidateQueries({ queryKey: keys.shops.detail(shopId ?? "") });
    },
  });
}
