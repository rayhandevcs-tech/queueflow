"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Camera, Check, ImageOff, Scissors, Sparkles } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { useLanguage, useT } from "@/lib/i18n";
import type { Hairstyle } from "@/types";
import type { StyleKind } from "../api/style.api";
import {
  useClearStylePick,
  useHairstyles,
  useSaveStylePick,
  useStyleAdvice,
  useStylePick,
  type StyleErrorCode,
} from "../hooks/use-style";
import type { StyleAdvice } from "../lib/advice-schema";
import { customerStyleDict } from "../lib/i18n";
import { TryOnCanvas } from "./TryOnCanvas";

/**
 * Look at yourself, see what suits you, tell the shop.
 *
 * `serialId` is optional on purpose: browsing the catalogue is worth doing
 * before you have a booking, and gating the whole screen behind one would mean
 * the feature only exists in the few minutes between booking and being called.
 * Without it everything works except sending a choice to the shop.
 */
export function StyleStudioView({ serialId }: { serialId?: string }) {
  const t = useT(customerStyleDict);
  const [kind, setKind] = useState<StyleKind>("HAIR");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [tryingOn, setTryingOn] = useState<Hairstyle | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const styles = useHairstyles(kind);
  const advice = useStyleAdvice();
  const pick = useStylePick(serialId);

  // The photo lives as an object URL for as long as the screen is open. It is
  // released on unmount and on replacement — a blob URL that is never revoked
  // keeps the whole image alive in memory for the tab's lifetime.
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    setPhotoUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
    advice.reset();
    advice.mutate({ file, kind });
  };

  const byslug = new Map((styles.data ?? []).map((s) => [s.slug, s] as const));
  const result = advice.data;

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="font-display text-[27px] font-bold text-ink">{t("pageTitle")}</h1>
        <p className="mt-1 text-[13px] text-muted">{t("pageSubtitle")}</p>
      </div>

      <div className="flex gap-1.5 rounded-xl bg-soft p-1">
        {(["HAIR", "BEARD"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              advice.reset();
            }}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors",
              kind === k ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {k === "HAIR" ? t("tabHair") : t("tabBeard")}
          </button>
        ))}
      </div>

      <PhotoCard
        photoUrl={photoUrl}
        pending={advice.isPending}
        onChoose={() => fileRef.current?.click()}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onPickFile(e.target.files?.[0]);
          // Reset so choosing the same file twice still fires a change.
          e.target.value = "";
        }}
      />

      {advice.error && <ErrorNote code={advice.error.code} />}

      {result && (
        <AdviceSection
          advice={result}
          styleBySlug={byslug}
          onTryOn={setTryingOn}
          selectedId={pick.data?.hairstyle_id}
        />
      )}

      <section>
        <h2 className="mb-2 px-1 text-[11px] font-bold tracking-wide text-muted uppercase">
          {t("allStylesTitle")}
        </h2>
        {styles.isPending ? (
          <div className="grid min-h-[20vh] place-items-center">
            <Spinner className="h-5 w-5 text-muted" />
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {(styles.data ?? []).map((s) => (
              <StyleCard
                key={s.id}
                style={s}
                selected={pick.data?.hairstyle_id === s.id}
                onClick={() => setTryingOn(s)}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="px-1 text-center text-[11px] text-muted">{t("aiCaveat")}</p>

      {tryingOn && (
        <TryOnSheet
          style={tryingOn}
          photoUrl={photoUrl}
          serialId={serialId}
          alreadyPicked={pick.data?.hairstyle_id === tryingOn.id}
          existingNote={pick.data?.note ?? ""}
          onClose={() => setTryingOn(null)}
        />
      )}
    </div>
  );
}

function PhotoCard({
  photoUrl,
  pending,
  onChoose,
}: {
  photoUrl: string | null;
  pending: boolean;
  onChoose: () => void;
}) {
  const t = useT(customerStyleDict);

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      {photoUrl ? (
        <div className="flex items-center gap-3.5">
          <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-soft">
            {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL from the user's own file */}
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            {pending ? (
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <Spinner className="h-4 w-4 text-muted" />
                {t("adviceLoading")}
              </p>
            ) : (
              <p className="text-[13px] font-semibold text-ink">{t("uploadTitle")}</p>
            )}
            <p className="mt-0.5 text-[11px] text-muted">{t("privacyNote")}</p>
            <button
              type="button"
              onClick={onChoose}
              disabled={pending}
              className="mt-2 text-[12px] font-semibold text-accent hover:underline disabled:opacity-50"
            >
              {t("changePhotoCta")}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-accent/10 text-accent">
            <Camera className="h-5 w-5" />
          </span>
          <p className="mt-2.5 text-[14px] font-bold text-ink">{t("uploadTitle")}</p>
          <p className="mt-0.5 text-[12px] text-muted">{t("uploadBody")}</p>
          <Button size="sm" className="mt-3" onClick={onChoose}>
            {t("uploadCta")}
          </Button>
          <p className="mt-2.5 text-[11px] text-muted">{t("privacyNote")}</p>
        </div>
      )}
    </section>
  );
}

function ErrorNote({ code }: { code: StyleErrorCode }) {
  const t = useT(customerStyleDict);
  const message =
    code === "REFUSED"
      ? t("errRefused")
      : code === "NO_MATCH"
        ? t("errNoMatch")
        : code === "IMAGE_TOO_LARGE"
          ? t("errTooLarge")
          : code === "ANTHROPIC_KEY_MISSING"
            ? t("errNoKey")
            : t("errGeneric");

  return (
    <p className="flex items-start gap-2 rounded-xl bg-live-soft p-3 text-[13px] text-live">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

function AdviceSection({
  advice,
  styleBySlug,
  onTryOn,
  selectedId,
}: {
  advice: StyleAdvice;
  styleBySlug: Map<string, Hairstyle>;
  onTryOn: (s: Hairstyle) => void;
  selectedId?: string;
}) {
  const t = useT(customerStyleDict);
  const { language } = useLanguage();
  const avoidStyle = advice.avoid ? styleBySlug.get(advice.avoid.slug) : null;

  return (
    <section className="space-y-3.5 rounded-2xl border border-accent/30 bg-accent/[0.05] p-4">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
        <Sparkles className="h-4.5 w-4.5 text-accent" />
        {t("recommendedTitle")}
      </h2>

      <div>
        <p className="text-[11px] font-bold tracking-wide text-muted uppercase">
          {t("faceReadTitle")}
        </p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink">{advice.faceRead}</p>
      </div>

      {advice.caveat && (
        <p className="flex items-start gap-2 rounded-xl bg-brass-soft p-2.5 text-[12px] text-brass">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{advice.caveat}</span>
        </p>
      )}

      <ul className="space-y-2">
        {advice.recommendations.map((r) => {
          const style = styleBySlug.get(r.slug);
          if (!style) return null;
          return (
            <li key={r.slug}>
              <button
                type="button"
                onClick={() => onTryOn(style)}
                className="flex w-full items-start gap-3 rounded-xl border border-line bg-card p-3 text-left transition-colors hover:border-accent/50"
              >
                <StyleThumb style={style} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-bold text-ink">
                      {language === "bn" ? style.name_bn : style.name_en}
                    </span>
                    {selectedId === style.id && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-good" />
                    )}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">
                    {r.reason}
                  </span>
                  <span
                    className={cn(
                      "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold",
                      r.confidence === "high"
                        ? "bg-good-soft text-good"
                        : "bg-soft text-muted",
                    )}
                  >
                    {r.confidence === "high" ? t("confidenceHigh") : t("confidenceMedium")}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {advice.avoid && avoidStyle && (
        <div className="rounded-xl bg-soft p-3">
          <p className="text-[11px] font-bold tracking-wide text-muted uppercase">
            {t("avoidTitle")}
          </p>
          <p className="mt-0.5 text-[13px] font-semibold text-ink">
            {language === "bn" ? avoidStyle.name_bn : avoidStyle.name_en}
          </p>
          <p className="text-[12px] text-muted">{advice.avoid.reason}</p>
        </div>
      )}
    </section>
  );
}

function StyleThumb({ style, size }: { style: Hairstyle; size: number }) {
  return style.reference_image_url ? (
    <Image
      src={style.reference_image_url}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-lg object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-lg bg-soft text-muted"
      style={{ width: size, height: size }}
    >
      <Scissors className="h-4 w-4" />
    </span>
  );
}

function StyleCard({
  style,
  selected,
  onClick,
}: {
  style: Hairstyle;
  selected: boolean;
  onClick: () => void;
}) {
  const { language } = useLanguage();

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card text-left transition-colors",
          selected ? "border-accent" : "border-line hover:border-accent/40",
        )}
      >
        <span className="relative block aspect-square w-full bg-soft">
          {style.reference_image_url ? (
            <Image
              src={style.reference_image_url}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              className="object-cover"
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-muted">
              <ImageOff className="h-5 w-5" />
            </span>
          )}
          {selected && (
            <span className="absolute top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-ink">
              <Check className="h-3 w-3" />
            </span>
          )}
        </span>
        <span className="p-2.5">
          <span className="block text-[12px] font-bold text-ink">
            {language === "bn" ? style.name_bn : style.name_en}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-muted">
            {language === "bn" ? style.description_bn : style.description_en}
          </span>
        </span>
      </button>
    </li>
  );
}

function TryOnSheet({
  style,
  photoUrl,
  serialId,
  alreadyPicked,
  existingNote,
  onClose,
}: {
  style: Hairstyle;
  photoUrl: string | null;
  serialId?: string;
  alreadyPicked: boolean;
  existingNote: string;
  onClose: () => void;
}) {
  const t = useT(customerStyleDict);
  const { language } = useLanguage();
  const showToast = useToast();
  const [note, setNote] = useState(existingNote);

  const save = useSaveStylePick(serialId);
  const clear = useClearStylePick(serialId);

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={language === "bn" ? style.name_bn : style.name_en}
      maxWidthClassName="max-w-md"
    >
      <p className="text-[12px] leading-relaxed text-muted">
        {language === "bn" ? style.description_bn : style.description_en}
      </p>

      {photoUrl ? (
        <TryOnCanvas
          photoUrl={photoUrl}
          overlayUrl={style.overlay_image_url}
          styleName={language === "bn" ? style.name_bn : style.name_en}
        />
      ) : style.reference_image_url ? (
        <Image
          src={style.reference_image_url}
          alt=""
          width={512}
          height={512}
          className="w-full rounded-2xl object-cover"
        />
      ) : null}

      {serialId ? (
        <div className="space-y-2.5">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("pickNotePlaceholder")}
            maxLength={300}
            className="w-full rounded-xl border border-line bg-soft px-3.5 py-2.5 text-[13px] text-ink outline-none placeholder:text-muted focus:border-accent"
          />
          <Button
            className="w-full"
            loading={save.isPending}
            onClick={() =>
              save.mutate(
                { hairstyle_id: style.id, note: note.trim() || null },
                {
                  onSuccess: () => {
                    showToast(t("pickSaved"));
                    onClose();
                  },
                },
              )
            }
          >
            {t("pickSaveCta")}
          </Button>
          {alreadyPicked && (
            <button
              type="button"
              onClick={() => clear.mutate(undefined, { onSuccess: onClose })}
              className="w-full py-1 text-center text-[12px] font-semibold text-muted hover:text-ink"
            >
              {t("pickClearCta")}
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-soft p-3">
          <p className="text-[13px] font-semibold text-ink">{t("noSerialTitle")}</p>
          <p className="mt-0.5 text-[11px] text-muted">{t("noSerialBody")}</p>
        </div>
      )}
    </BottomSheet>
  );
}
