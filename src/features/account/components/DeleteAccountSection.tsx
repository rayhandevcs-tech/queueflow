"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { useT } from "@/lib/i18n";
import { useDeleteMyAccount } from "../hooks/use-delete-account";
import { accountDict } from "../lib/i18n";

export function DeleteAccountSection() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteAccount = useDeleteMyAccount();
  const t = useT(accountDict);

  return (
    <>
      <Button
        variant="danger"
        size="lg"
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
        className="w-full"
      >
        <Trash2 className="h-4 w-4" />
        {t("deleteAccountCta")}
      </Button>
      {error && <p className="mt-2 text-center text-xs font-medium text-live">{error}</p>}

      <ConfirmSheet
        open={confirmOpen}
        title={t("deleteAccountTitle")}
        description={t("deleteAccountDescription")}
        confirmLabel={t("deleteConfirm")}
        cancelLabel={t("keepAccount")}
        loading={deleteAccount.isPending}
        onConfirm={() =>
          deleteAccount.mutate(undefined, {
            onError: (err) => {
              setConfirmOpen(false);
              setError(err instanceof Error ? err.message : t("deleteFailedGeneric"));
            },
          })
        }
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
