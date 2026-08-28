"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Camera, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import {
  useApplySetup,
  useGenerateSetup,
  type SetupErrorCode,
} from "../hooks/use-shop-setup";
import type { ShopSetupDraft } from "../lib/setup-schema";
import { providerSetupDict } from "../lib/i18n";

const MAX_PHOTOS = 3;

/**
 * Finish setting up a shop from a few photos.
 *
 * Shown only while the catalogue is empty. Most owners abandon setup partway
 * through typing a service list, and the fix is not a nicer form — it is not
 * having to write one.
 *
 * The draft is fully editable before anything is written. A setup assistant
 * that saved straight to the database would fill a real shop's catalogue with
 * services it does not offer at prices it does not charge, and the owner would
 * spend longer deleting than they would have spent typing.
 */
export function ShopSetupCard({ shopId }: { shopId: string | undefined }) {
  const t = useT(providerSetupDict);
  const showToast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [draft, setDraft] = useState<ShopSetupDraft | null>(null);
  const [benchmarkCount, setBenchmarkCount] = useState(0);

  const generate = useGenerateSetup();
  const apply = useApplySetup(shopId);

  const reset = () => {
    setFiles([]);
    setDraft(null);
    generate.reset();
  };

  if (draft) {
    return (
      <DraftEditor
        draft={draft}
        benchmarkCount={benchmarkCount}
        onChange={setDraft}
        applying={apply.isPending}
        failed={apply.isError}
        onApply={() =>
          apply.mutate(draft, {
            onSuccess: () => {
              showToast(t("applied"));
              reset();
            },
          })
        }
        onDiscard={reset}
      />
    );
  }

  return (
    <section className="rounded-2xl border border-accent/30 bg-accent/[0.05] p-4">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
        <Sparkles className="h-4.5 w-4.5 text-accent" />
        {t("cardTitle")}
      </h2>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">{t("cardBody")}</p>

      {generate.isPending ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <Spinner className="h-5 w-5 text-muted" />
          <p className="text-[13px] font-semibold text-ink">{t("generating")}</p>
          <p className="text-[11px] text-muted">{t("generatingHint")}</p>
        </div>
      ) : (
        <>
          {generate.error && <ErrorNote code={generate.error.code} />}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Camera className="mr-1.5 h-4 w-4" />
              {t("startCta")}
            </Button>

            {files.length > 0 && (
              <>
                <span className="text-[12px] text-muted">{t("photoCount", files.length)}</span>
                <Button
                  size="sm"
                  onClick={() =>
                    generate.mutate(files, {
                      onSuccess: (result) => {
                        setDraft(result.draft);
                        setBenchmarkCount(result.benchmarkCount);
                      },
                    })
                  }
                >
                  {t("generateCta")}
                </Button>
              </>
            )}
          </div>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS);
          if (picked.length) setFiles(picked);
          e.target.value = "";
        }}
      />
    </section>
  );
}

function DraftEditor({
  draft,
  benchmarkCount,
  onChange,
  applying,
  failed,
  onApply,
  onDiscard,
}: {
  draft: ShopSetupDraft;
  benchmarkCount: number;
  onChange: (draft: ShopSetupDraft) => void;
  applying: boolean;
  failed: boolean;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const t = useT(providerSetupDict);

  const patchService = (index: number, patch: Partial<ShopSetupDraft["services"][number]>) => {
    const services = draft.services.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange({ ...draft, services });
  };

  return (
    <section className="space-y-4 rounded-2xl border border-accent/30 bg-card p-4">
      <div>
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <Sparkles className="h-4.5 w-4.5 text-accent" />
          {t("cardTitle")}
        </h2>
        <p className="mt-1 text-[11px] text-muted">{t("editHint")}</p>
      </div>

      {/* Where the prices came from. An owner about to publish a price list
          deserves to know whether it is anchored to real local figures or is a
          guess they need to check. */}
      <p className="rounded-xl bg-soft p-3 text-[12px] text-muted">
        {benchmarkCount > 0 ? t("benchmarkNote", benchmarkCount) : t("noBenchmarkNote")}
      </p>

      {draft.photoNote && (
        <p className="flex items-start gap-2 rounded-xl bg-brass-soft p-3 text-[12px] text-brass">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{draft.photoNote}</span>
        </p>
      )}

      <div>
        <label className="mb-1 block text-[11px] font-bold tracking-wide text-muted uppercase">
          {t("aboutLabel")}
        </label>
        <textarea
          value={draft.about}
          onChange={(e) => onChange({ ...draft, about: e.target.value })}
          rows={4}
          className="w-full resize-y rounded-xl border border-line bg-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-ink outline-none focus:border-accent"
        />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold tracking-wide text-muted uppercase">
          {t("servicesLabel")}
        </p>
        <ul className="space-y-2.5">
          {draft.services.map((service, i) => (
            <li key={i} className="rounded-xl border border-line bg-soft p-3">
              <div className="flex items-start gap-2">
                <input
                  value={service.nameBn}
                  onChange={(e) => patchService(i, { nameBn: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[13px] font-semibold text-ink outline-none focus:border-accent"
                />
                <button
                  type="button"
                  aria-label={t("removeCta")}
                  onClick={() =>
                    onChange({ ...draft, services: draft.services.filter((_, j) => j !== i) })
                  }
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-card hover:text-live"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-[11px] text-muted">
                  {t("rateLabel")}
                  <input
                    type="number"
                    min={0}
                    value={service.rate}
                    onChange={(e) => patchService(i, { rate: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-line bg-card px-2 py-1 text-[13px] font-semibold text-ink tabular-nums outline-none focus:border-accent"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-muted">
                  {t("durationLabel")}
                  <input
                    type="number"
                    min={1}
                    value={service.durationMin}
                    onChange={(e) => patchService(i, { durationMin: Number(e.target.value) })}
                    className="w-16 rounded-lg border border-line bg-card px-2 py-1 text-[13px] font-semibold text-ink tabular-nums outline-none focus:border-accent"
                  />
                </label>
              </div>

              {service.priceNote && (
                <p className="mt-1.5 text-[11px] text-muted">{service.priceNote}</p>
              )}
            </li>
          ))}
        </ul>
      </div>

      {failed && <p className="text-[12px] text-live">{t("errGeneric")}</p>}

      <div className="flex gap-2">
        <Button className="flex-1" loading={applying} onClick={onApply}>
          {applying ? t("applying") : t("applyCta")}
        </Button>
        <Button variant="ghost" onClick={onDiscard}>
          {t("discardCta")}
        </Button>
      </div>

      <p className="text-center text-[11px] text-muted">{t("caveat")}</p>
    </section>
  );
}

function ErrorNote({ code }: { code: SetupErrorCode }) {
  const t = useT(providerSetupDict);
  const message =
    code === "NO_SHOP"
      ? t("errNoShop")
      : code === "IMAGE_TOO_LARGE"
        ? t("errTooLarge")
        : code === "REFUSED"
          ? t("errRefused")
          : code === "ANTHROPIC_KEY_MISSING"
            ? t("errNoKey")
            : t("errGeneric");

  return (
    <p className="mt-3 flex items-start gap-2 rounded-xl bg-live-soft p-3 text-[13px] text-live">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
