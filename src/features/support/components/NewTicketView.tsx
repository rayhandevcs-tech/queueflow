"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { SUPPORT_CATEGORIES, SUPPORT_CATEGORY_LABEL } from "@/config/constants";
import { useT } from "@/lib/i18n";
import type { SupportCategory } from "@/types";
import { uploadTicketImages } from "../api/storage.api";
import { useTicketMutations } from "../hooks/use-tickets";
import { ImagePickerRow } from "./ImagePickerRow";
import { supportDict } from "../lib/i18n";

export function NewTicketView() {
  const router = useRouter();
  const t = useT(supportDict);
  const categoryT = useT(SUPPORT_CATEGORY_LABEL);
  const { create } = useTicketMutations();

  const [category, setCategory] = useState<SupportCategory>("BOOKING");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = subject.trim().length >= 3 && body.trim().length > 0;
  const busy = uploading || create.isPending;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setError(null);

    try {
      // Images go up first so the ticket is created with its evidence already
      // attached — a half-written ticket waiting on an upload is worse than a
      // slightly slower submit.
      setUploading(true);
      const images = await uploadTicketImages(files);
      setUploading(false);

      const id = await create.mutateAsync({ category, subject, body, images });
      router.replace(`/help/tickets/${id}`);
    } catch (err) {
      setUploading(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Card tone="accent" className="flex items-start gap-3.5 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent/12 text-accent">
          <LifeBuoy className="h-5 w-5" />
        </span>
        <div className="space-y-0.5">
          <p className="font-display text-[15px] font-bold text-ink">{t("newTicketTitle")}</p>
          <p className="text-[13px] leading-relaxed text-muted">{t("newTicketHint")}</p>
        </div>
      </Card>

      <Field label={t("categoryLabel")}>
        <div className="flex flex-wrap gap-2">
          {SUPPORT_CATEGORIES.map((value) => {
            const selected = value === category;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                aria-pressed={selected}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-[13px] font-semibold transition-all duration-150",
                  "focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none",
                  selected
                    ? "border-accent bg-accent/[0.09] text-accent shadow-xs"
                    : "border-line bg-soft text-muted hover:border-line/80 hover:bg-card hover:text-ink",
                )}
              >
                {categoryT(value)}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label={t("subjectLabel")}>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t("subjectPlaceholder")}
          maxLength={120}
        />
      </Field>

      <Field label={t("bodyLabel")}>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("bodyPlaceholder")}
          rows={6}
          maxLength={2000}
        />
      </Field>

      <Field label={t("screenshotLabel")}>
        <ImagePickerRow files={files} onChange={setFiles} disabled={busy} />
      </Field>

      {error && (
        <p
          role="alert"
          className="rounded-[14px] border border-live/25 bg-live-soft px-3.5 py-2.5 text-sm font-medium text-live"
        >
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!canSubmit}>
        {busy ? t("submitting") : t("submitTicket")}
      </Button>
    </form>
  );
}
