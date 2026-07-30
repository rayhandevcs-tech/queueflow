"use client";

import { Button } from "@/components/ui/Button";
import { useT, type Dict } from "@/lib/i18n";

const dict = {
  confirm: { bn: "নিশ্চিত করো", en: "Confirm" },
  cancel: { bn: "বাতিল", en: "Cancel" },
} satisfies Dict;

export function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  loading,
  variant = "danger",
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  variant?: "danger" | "primary";
}) {
  const t = useT(dict);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 grid place-items-end bg-ink/50 p-4 backdrop-blur-sm sm:place-items-center">
      <div className="w-full max-w-sm space-y-4 rounded-t-3xl bg-card p-5 pb-6 shadow-lg animate-slide-up sm:rounded-2xl sm:animate-none">
        <div className="mx-auto h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="space-y-1.5 text-center sm:text-left">
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={loading} className="sm:w-auto">
            {cancelLabel ?? t("cancel")}
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            loading={loading}
            className="sm:w-auto"
          >
            {confirmLabel ?? t("confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
