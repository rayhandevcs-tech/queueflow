"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageOff, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { keys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { useLanguage, useT } from "@/lib/i18n";
import {
  listHairstyles,
  updateHairstyle,
  uploadStyleImage,
  type AdminHairstyle,
  type StyleImageKind,
} from "../api/admin.api";
import { adminDict } from "../lib/i18n";

/**
 * Where the catalogue's images come from.
 *
 * The styles themselves are seeded in SQL and not editable here — their names,
 * descriptions and "suits" notes are what the AI advisor reads, and letting
 * those be edited casually would change the advice every customer gets. What
 * this screen owns is the two images per style, which are pure presentation and
 * the one thing that genuinely needs a person with a file picker.
 */
export function StyleCatalogueView() {
  const t = useT(adminDict);
  const [kind, setKind] = useState<"HAIR" | "BEARD">("HAIR");

  const styles = useQuery({
    queryKey: keys.admin.hairstyles(),
    queryFn: listHairstyles,
  });

  const rows = (styles.data ?? []).filter((s) => s.kind === kind);
  const withImages = (styles.data ?? []).filter(
    (s) => s.reference_image_url || s.overlay_image_url,
  ).length;

  return (
    <div className="space-y-5">
      <PageHeader title={t("stylesTitle")} description={t("stylesSubtitle")} />

      {styles.data && styles.data.length > 0 && (
        <p className="rounded-xl bg-soft p-3 text-[13px] text-muted">
          {t("styleProgress", withImages, styles.data.length)}
        </p>
      )}

      <div className="flex gap-1.5 rounded-xl bg-soft p-1">
        {(["HAIR", "BEARD"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors",
              kind === k ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {k === "HAIR" ? t("styleTabHair") : t("styleTabBeard")}
          </button>
        ))}
      </div>

      {styles.isPending ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner className="h-6 w-6 text-muted" />
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((style) => (
            <StyleRow key={style.id} style={style} />
          ))}
        </ul>
      )}
    </div>
  );
}

function StyleRow({ style }: { style: AdminHairstyle }) {
  const t = useT(adminDict);
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const showToast = useToast();
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async ({ kind, file }: { kind: StyleImageKind; file: File }) => {
      const url = await uploadStyleImage(style.slug, kind, file);
      await updateHairstyle(style.id, {
        [kind === "reference" ? "reference_image_url" : "overlay_image_url"]: url,
      });
    },
    onSuccess: () => {
      setError(null);
      showToast(t("styleImagesDone"));
      void queryClient.invalidateQueries({ queryKey: keys.admin.hairstyles() });
    },
    onError: (err) => setError(err instanceof Error ? err.message : t("styleImageTypeError")),
  });

  return (
    <li className="rounded-2xl border border-line bg-card p-3.5">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
          {language === "bn" ? style.name_bn : style.name_en}
        </p>
        <code className="shrink-0 rounded bg-soft px-1.5 py-0.5 text-[10px] text-muted">
          {style.slug}
        </code>
      </div>
      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">
        {language === "bn" ? style.description_bn : style.description_en}
      </p>

      {/* Capped rather than full-width: these are thumbnails to check at a
          glance, and a half-column square on a desktop admin page is the size
          of a poster. */}
      <div className="mt-3 grid max-w-xs grid-cols-2 gap-2.5">
        <ImageSlot
          label={t("styleReferenceLabel")}
          url={style.reference_image_url}
          busy={upload.isPending}
          onPick={(file) => upload.mutate({ kind: "reference", file })}
        />
        <ImageSlot
          label={t("styleOverlayLabel")}
          url={style.overlay_image_url}
          busy={upload.isPending}
          onPick={(file) => upload.mutate({ kind: "overlay", file })}
          // Checkerboard, so a PNG that is secretly opaque is obvious at a
          // glance — an overlay with a white background looks fine on white and
          // ruins the try-on the moment it lands on someone's face.
          checkered
        />
      </div>

      <p className="mt-1.5 text-[10px] text-muted">{t("styleOverlayHint")}</p>
      {error && <p className="mt-1.5 text-[11px] text-live">{error}</p>}
    </li>
  );
}

function ImageSlot({
  label,
  url,
  busy,
  onPick,
  checkered = false,
}: {
  label: string;
  url: string | null;
  busy: boolean;
  onPick: (file: File) => void;
  checkered?: boolean;
}) {
  const t = useT(adminDict);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <p className="mb-1 text-[10px] font-bold tracking-wide text-muted uppercase">{label}</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative grid aspect-square w-full place-items-center overflow-hidden rounded-xl border border-line transition-colors hover:border-accent/50 disabled:opacity-60",
          checkered ? "bg-[repeating-conic-gradient(var(--color-soft)_0_25%,transparent_0_50%)] bg-[length:16px_16px]" : "bg-soft",
        )}
      >
        {url ? (
          // A plain img, like every other Supabase-hosted image in this app.
          // next/image would need the storage hostname allowlisted in
          // next.config, and would bill per optimised image for assets that are
          // already small and already on a CDN.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-muted">
            <ImageOff className="h-5 w-5" />
            <span className="text-[10px]">{t("styleNoImages")}</span>
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-card/70">
            <Spinner className="h-4 w-4 text-muted" />
          </span>
        )}
      </button>
      <span className="mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-accent">
        <Upload className="h-3 w-3" />
        {url ? t("styleReplaceCta") : t("styleUploadCta")}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
