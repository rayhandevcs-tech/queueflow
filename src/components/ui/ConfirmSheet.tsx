"use client";

import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
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

  return (
    <BottomSheet open={open} onClose={onCancel}>
      <div className="space-y-1.5 text-center sm:text-left">
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={loading} className="sm:w-auto">
          {cancelLabel ?? t("cancel")}
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading} className="sm:w-auto">
          {confirmLabel ?? t("confirm")}
        </Button>
      </div>
    </BottomSheet>
  );
}
