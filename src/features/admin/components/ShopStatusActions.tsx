"use client";

import { useState } from "react";
import { BadgeCheck, Ban, RotateCcw, Star, Undo2, XCircle } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import type { ShopStatus } from "@/types";
import { useAdminShopMutations } from "../hooks/use-admin";
import { adminDict } from "../lib/i18n";

interface Props {
  shopId: string;
  status: ShopStatus;
  isFeatured: boolean;
  /** Compact row for the verification queue vs. full panel on the detail page. */
  layout?: "row" | "panel";
}

type PendingAction = {
  status: ShopStatus;
  titleKey: "approveConfirmTitle" | "rejectConfirmTitle" | "suspendConfirmTitle" | "restoreConfirmTitle";
  descKey: "approveConfirmDesc" | "rejectConfirmDesc" | "suspendConfirmDesc" | "restoreConfirmDesc";
  /** Reject/suspend must tell the owner why — that text is the notification body. */
  needsReason: boolean;
  danger: boolean;
};

const ACTIONS = {
  approve: {
    status: "ACTIVE",
    titleKey: "approveConfirmTitle",
    descKey: "approveConfirmDesc",
    needsReason: false,
    danger: false,
  },
  reject: {
    status: "REJECTED",
    titleKey: "rejectConfirmTitle",
    descKey: "rejectConfirmDesc",
    needsReason: true,
    danger: true,
  },
  suspend: {
    status: "SUSPENDED",
    titleKey: "suspendConfirmTitle",
    descKey: "suspendConfirmDesc",
    needsReason: true,
    danger: true,
  },
  restore: {
    status: "ACTIVE",
    titleKey: "restoreConfirmTitle",
    descKey: "restoreConfirmDesc",
    needsReason: false,
    danger: false,
  },
  backToPending: {
    status: "PENDING",
    titleKey: "restoreConfirmTitle",
    descKey: "restoreConfirmDesc",
    needsReason: false,
    danger: false,
  },
} as const satisfies Record<string, PendingAction>;

export function ShopStatusActions({ shopId, status, isFeatured, layout = "panel" }: Props) {
  const t = useT(adminDict);
  const showToast = useToast();
  const { changeStatus, changeFeatured } = useAdminShopMutations(shopId);

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  const close = () => {
    setPending(null);
    setReason("");
    setReasonError(null);
  };

  const confirm = () => {
    if (!pending) return;
    if (pending.needsReason && !reason.trim()) {
      setReasonError(t("reasonRequired"));
      return;
    }
    changeStatus.mutate(
      { status: pending.status, reason: pending.needsReason ? reason : null },
      {
        onSuccess: () => {
          showToast(t("statusUpdated"));
          close();
        },
        onError: () => showToast(t("statusUpdateFailed")),
      },
    );
  };

  const toggleFeatured = () => {
    changeFeatured.mutate(
      { featured: !isFeatured },
      {
        onSuccess: () => showToast(t("featuredUpdated")),
        onError: () => showToast(t("featuredFailed")),
      },
    );
  };

  const size = layout === "row" ? "sm" : "md";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {(status === "PENDING" || status === "REJECTED" || status === "SUSPENDED") && (
          <Button
            size={size}
            onClick={() => setPending(status === "PENDING" ? ACTIONS.approve : ACTIONS.restore)}
          >
            {status === "PENDING" ? (
              <BadgeCheck className="h-4 w-4" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {status === "PENDING" ? t("approve") : t("restore")}
          </Button>
        )}

        {status === "PENDING" && (
          <Button size={size} variant="danger" onClick={() => setPending(ACTIONS.reject)}>
            <XCircle className="h-4 w-4" />
            {t("reject")}
          </Button>
        )}

        {status === "ACTIVE" && (
          <>
            <Button size={size} variant="danger" onClick={() => setPending(ACTIONS.suspend)}>
              <Ban className="h-4 w-4" />
              {t("suspend")}
            </Button>
            <Button
              size={size}
              variant={isFeatured ? "soft" : "outline"}
              loading={changeFeatured.isPending}
              onClick={toggleFeatured}
            >
              <Star className={isFeatured ? "h-4 w-4 fill-brass text-brass" : "h-4 w-4"} />
              {isFeatured ? t("removeFeatured") : t("makeFeatured")}
            </Button>
          </>
        )}

        {layout === "panel" && status !== "PENDING" && (
          <Button size={size} variant="ghost" onClick={() => setPending(ACTIONS.backToPending)}>
            <Undo2 className="h-4 w-4" />
            {t("backToPending")}
          </Button>
        )}
      </div>

      <BottomSheet
        open={!!pending}
        onClose={close}
        title={pending ? t(pending.titleKey) : undefined}
      >
        {pending && (
          <div className="space-y-4">
            <p className="text-sm text-muted">{t(pending.descKey)}</p>

            {pending.needsReason && (
              <Field label={t("reasonLabel")} error={reasonError ?? undefined}>
                <Input
                  autoFocus
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setReasonError(null);
                  }}
                  placeholder={t("reasonPlaceholder")}
                  invalid={!!reasonError}
                />
              </Field>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={close} disabled={changeStatus.isPending}>
                {t("cancelLabel")}
              </Button>
              <Button
                variant={pending.danger ? "danger" : "primary"}
                loading={changeStatus.isPending}
                onClick={confirm}
              >
                {t("confirmLabel")}
              </Button>
            </div>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
