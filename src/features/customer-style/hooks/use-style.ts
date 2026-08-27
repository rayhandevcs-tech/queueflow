"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { compressImage, IMAGE_PRESETS } from "@/lib/image-compress";
import {
  clearStylePick,
  getHairstyles,
  getStylePick,
  saveStylePick,
  type StyleKind,
  type StylePick,
} from "../api/style.api";
import type { StyleAdvice } from "../lib/advice-schema";

export type StyleErrorCode =
  | "REFUSED"
  | "NO_MATCH"
  | "IMAGE_TOO_LARGE"
  | "ANTHROPIC_KEY_MISSING"
  | "GENERIC";

export class StyleError extends Error {
  constructor(public code: StyleErrorCode) {
    super(code);
  }
}

export function useHairstyles(kind: StyleKind) {
  return useQuery({
    queryKey: keys.hairstyles.byKind(kind),
    queryFn: () => getHairstyles(kind),
    // The catalogue changes when an admin edits it, which is roughly never.
    staleTime: 30 * 60_000,
  });
}

/** Strips the `data:image/...;base64,` prefix the FileReader adds. */
function toBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new StyleError("GENERIC"));
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

export function useStyleAdvice() {
  return useMutation<StyleAdvice, StyleError, { file: File; kind: StyleKind }>({
    mutationFn: async ({ file, kind }) => {
      // Compressed before it leaves the device: a phone photo is several
      // megabytes, and every one of those bytes would be uploaded, then billed
      // as vision tokens, for no gain in what the model can see.
      const small = await compressImage(file, IMAGE_PRESETS.attachment);
      const { data, mediaType } = await toBase64(small);

      const res = await fetch("/api/ai/style-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: data,
          // compressImage returns WebP; anything it declined to touch keeps
          // its own type, and the route only accepts these three.
          mediaType: ["image/jpeg", "image/png", "image/webp"].includes(mediaType)
            ? mediaType
            : "image/jpeg",
          kind,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        const code = body?.error;
        throw new StyleError(
          code === "REFUSED" ||
          code === "NO_MATCH" ||
          code === "IMAGE_TOO_LARGE" ||
          code === "ANTHROPIC_KEY_MISSING"
            ? code
            : "GENERIC",
        );
      }

      const body = (await res.json()) as { advice: StyleAdvice };
      return body.advice;
    },
  });
}

export function useStylePick(serialId: string | undefined) {
  return useQuery({
    queryKey: keys.stylePick.bySerial(serialId ?? ""),
    queryFn: () => getStylePick(serialId!),
    enabled: !!serialId,
  });
}

export function useSaveStylePick(serialId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<StylePick, "serial_id">) =>
      saveStylePick({ ...input, serial_id: serialId! }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: keys.stylePick.bySerial(serialId ?? "") }),
  });
}

export function useClearStylePick(serialId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => clearStylePick(serialId!),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: keys.stylePick.bySerial(serialId ?? "") }),
  });
}
