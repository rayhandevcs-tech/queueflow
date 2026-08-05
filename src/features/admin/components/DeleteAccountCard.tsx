"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { useAdminUserMutations, type AdminUserDetail } from "../hooks/use-admin";
import { adminDict } from "../lib/i18n";

export function DeleteAccountCard({ detail }: { detail: AdminUserDetail }) {
  const t = useT(adminDict);
  const router = useRouter();
  const showToast = useToast();
  const { removeAccount } = useAdminUserMutations(detail.profile.id);

  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const confirmWord = t("deleteConfirmWord");

  const close = () => {
    setOpen(false);
    setTyped("");
    setReason("");
    setError(null);
  };

  const confirm = () => {
    if (typed.trim() !== confirmWord) {
      setError(t("deleteMismatch"));
      return;
    }
    removeAccount.mutate(reason, {
      onSuccess: () => {
        showToast(t("deletedToast"));
        close();
        router.replace("/admin/users");
      },
      onError: (err) => {
        const message = (err as { message?: string } | null)?.message ?? "";
        showToast(
          message.includes("cannot delete a platform admin")
            ? t("cannotDeleteAdmin")
            : t("deleteFailed"),
        );
      },
    });
  };

  return (
    <>
      <Card className="border-live/30 p-4">
        <h2 className="text-sm font-bold text-live">{t("dangerZone")}</h2>
        <p className="mt-1 text-xs text-muted">{t("deleteIrreversible")}</p>
        <Button variant="danger" className="mt-3" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4" />
          {t("deleteAccount")}
        </Button>
      </Card>

      <BottomSheet open={open} onClose={close} title={t("deleteConfirmTitle")}>
        <div className="space-y-4">
          {/* Spell out the blast radius before the confirmation, not after. */}
          <div className="space-y-2 rounded-xl bg-soft px-3 py-2.5 text-xs text-muted">
            <p className="font-semibold text-ink">{t("deleteWhatHappensTitle")}</p>
            <p>{t("deleteFreesEmail", detail.email ?? "—")}</p>
            <p>{t("deleteKeepsShopHistory")}</p>
            <p>{t("deleteLosesOwnData")}</p>
            {detail.shop && (
              <p className="font-semibold text-live">
                {t("deleteLosesShop", detail.shop.name)}
              </p>
            )}
          </div>

          <Field label={t("deleteReasonLabel")}>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
            />
          </Field>

          <Field label={t("deleteTypeToConfirm", confirmWord)} error={error ?? undefined}>
            <Input
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setError(null);
              }}
              invalid={!!error}
              autoComplete="off"
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={close} disabled={removeAccount.isPending}>
              {t("cancelLabel")}
            </Button>
            <Button
              variant="danger"
              loading={removeAccount.isPending}
              onClick={confirm}
            >
              {t("deleteAccount")}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
