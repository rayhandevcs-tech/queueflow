"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { createReport, isDuplicateReport, REPORT_REASONS } from "@/lib/reports";
import { useT, type Dict } from "@/lib/i18n";
import type { ReportReason, ReportTargetType } from "@/types";

const dict = {
  report: { bn: "রিপোর্ট", en: "Report" },
  reportAria: { bn: "রিপোর্ট করো", en: "Report this" },
  sheetTitle: { bn: "কী সমস্যা?", en: "What's wrong?" },
  sheetDesc: {
    bn: "রিপোর্টটি শুধু প্ল্যাটফর্ম টিম দেখবে — যাকে রিপোর্ট করছো সে জানবে না।",
    en: "Only the platform team sees this — the person you're reporting isn't told.",
  },
  reasonSPAM: { bn: "স্প্যাম", en: "Spam" },
  reasonABUSE: { bn: "গালিগালাজ / হয়রানি", en: "Abuse or harassment" },
  reasonFAKE: { bn: "ভুয়া", en: "Fake" },
  reasonINAPPROPRIATE: { bn: "অশালীন", en: "Inappropriate" },
  reasonOTHER: { bn: "অন্যান্য", en: "Other" },
  noteLabel: { bn: "আরও কিছু বলার থাকলে (ঐচ্ছিক)", en: "Anything to add (optional)" },
  notePlaceholder: { bn: "সংক্ষেপে লেখো", en: "Keep it short" },
  cancel: { bn: "বাতিল", en: "Cancel" },
  submit: { bn: "রিপোর্ট পাঠাও", en: "Send report" },
  sent: { bn: "✓ রিপোর্ট পাঠানো হয়েছে — আমরা দেখছি", en: "✓ Report sent — we'll look into it" },
  alreadyReported: { bn: "এটা তুমি আগেই রিপোর্ট করেছো", en: "You've already reported this" },
  failed: { bn: "রিপোর্ট পাঠানো যায়নি — আবার চেষ্টা করো", en: "Couldn't send the report — try again" },
} satisfies Dict;

const REASON_KEY = {
  SPAM: "reasonSPAM",
  ABUSE: "reasonABUSE",
  FAKE: "reasonFAKE",
  INAPPROPRIATE: "reasonINAPPROPRIATE",
  OTHER: "reasonOTHER",
} as const satisfies Record<ReportReason, keyof typeof dict>;

interface Props {
  targetType: ReportTargetType;
  targetId: string;
  className?: string;
  /** Icon-only by default; pass true where there's room for the word. */
  withLabel?: boolean;
}

export function ReportButton({ targetType, targetId, className, withLabel }: Props) {
  const t = useT(dict);
  const showToast = useToast();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("SPAM");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);

  const submit = useMutation({
    mutationFn: () => createReport({ targetType, targetId, reason, note }),
    onSuccess: () => {
      showToast(t("sent"));
      setDone(true);
      setOpen(false);
    },
    onError: (error) => {
      if (isDuplicateReport(error)) {
        showToast(t("alreadyReported"));
        setDone(true);
        setOpen(false);
        return;
      }
      showToast(t("failed"));
    },
  });

  return (
    <>
      <button
        type="button"
        aria-label={t("reportAria")}
        title={t("reportAria")}
        disabled={done}
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-muted transition-colors hover:bg-soft hover:text-live disabled:opacity-40",
          className,
        )}
      >
        <Flag className="h-3.5 w-3.5" />
        {withLabel && t("report")}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={t("sheetTitle")}>
        <div className="space-y-4">
          <p className="text-sm text-muted">{t("sheetDesc")}</p>

          <div className="flex flex-wrap gap-1.5">
            {REPORT_REASONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setReason(value)}
                className={cn(
                  "min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors",
                  reason === value
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line bg-card text-muted hover:bg-soft",
                )}
              >
                {t(REASON_KEY[value])}
              </button>
            ))}
          </div>

          <Field label={t("noteLabel")}>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notePlaceholder")}
              maxLength={280}
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submit.isPending}
            >
              {t("cancel")}
            </Button>
            <Button variant="danger" loading={submit.isPending} onClick={() => submit.mutate()}>
              {t("submit")}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
