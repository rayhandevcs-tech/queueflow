"use client";

import { useState } from "react";
import { BadgeCheck, KeyRound, Mail, Save, ShieldAlert, Timer } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatBanglaDate } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { useAdminUserMutations, type AdminUserDetail } from "../hooks/use-admin";
import { adminDict } from "../lib/i18n";

/**
 * Everything support needs to unstick an account, in the order problems
 * actually arrive: wrong details → can't log in → can't book.
 */
export function AccountRepairCard({ detail }: { detail: AdminUserDetail }) {
  const t = useT(adminDict);

  return (
    <Card className="space-y-5 p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-bold text-ink">{t("repairTitle")}</h2>
        <p className="mt-0.5 text-xs text-muted">{t("repairSubtitle")}</p>
      </div>

      <ProfileFields detail={detail} />
      <LoginHelp detail={detail} />
      <StuckSerial detail={detail} />
    </Card>
  );
}

function ProfileFields({ detail }: { detail: AdminUserDetail }) {
  const t = useT(adminDict);
  const showToast = useToast();
  const { editProfile } = useAdminUserMutations(detail.profile.id);

  const [fullName, setFullName] = useState(detail.profile.full_name);
  const [phone, setPhone] = useState(detail.profile.phone ?? "");
  const [address, setAddress] = useState(detail.profile.address ?? "");
  const [error, setError] = useState<string | null>(null);

  const dirty =
    fullName !== detail.profile.full_name ||
    phone !== (detail.profile.phone ?? "") ||
    address !== (detail.profile.address ?? "");

  const save = () => {
    if (!fullName.trim()) {
      setError(t("nameRequired"));
      return;
    }
    editProfile.mutate(
      { full_name: fullName, phone, address },
      {
        onSuccess: () => showToast(t("profileSaved")),
        onError: () => showToast(t("profileSaveFailed")),
      },
    );
  };

  return (
    <section className="space-y-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-bold text-muted uppercase">{t("editProfileTitle")}</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("fieldFullName")} error={error ?? undefined}>
          <Input
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setError(null);
            }}
            invalid={!!error}
          />
        </Field>
        <Field label={t("fieldPhone")}>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </Field>
        <Field label={t("fieldAddress")} className="sm:col-span-2">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
      </div>

      <Button
        size="sm"
        disabled={!dirty}
        loading={editProfile.isPending}
        onClick={save}
      >
        <Save className="h-4 w-4" />
        {t("saveChanges")}
      </Button>
    </section>
  );
}

function LoginHelp({ detail }: { detail: AdminUserDetail }) {
  const t = useT(adminDict);
  const showToast = useToast();
  const { accountAction } = useAdminUserMutations(detail.profile.id);

  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const run = (action: "confirm_email" | "send_password_reset", toast: string) =>
    accountAction.mutate(
      { action },
      {
        onSuccess: () => showToast(toast),
        onError: () => showToast(t("accountActionFailed")),
      },
    );

  const changeEmail = () => {
    const next = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      setEmailError(t("invalidEmail"));
      return;
    }
    accountAction.mutate(
      { action: "change_email", email: next },
      {
        onSuccess: () => {
          showToast(t("emailChangedToast"));
          setNewEmail("");
        },
        onError: () => showToast(t("accountActionFailed")),
      },
    );
  };

  return (
    <section className="space-y-3 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-bold text-muted uppercase">{t("loginHelpTitle")}</h3>
        <Badge variant={detail.email_confirmed ? "good" : "brass"}>
          {detail.email_confirmed ? t("emailConfirmed") : t("emailNotConfirmed")}
        </Badge>
      </div>

      <div className="space-y-3">
        {!detail.email_confirmed && (
          <ActionRow
            icon={<BadgeCheck className="h-4 w-4" />}
            hint={t("confirmEmailHint")}
            action={
              <Button
                size="sm"
                variant="outline"
                loading={accountAction.isPending}
                onClick={() => run("confirm_email", t("emailConfirmedToast"))}
              >
                {t("confirmEmailAction")}
              </Button>
            }
          />
        )}

        <ActionRow
          icon={<KeyRound className="h-4 w-4" />}
          hint={t("sendResetHint")}
          action={
            <Button
              size="sm"
              variant="outline"
              loading={accountAction.isPending}
              onClick={() => run("send_password_reset", t("resetSentToast"))}
            >
              {t("sendResetAction")}
            </Button>
          }
        />

        <ActionRow
          icon={<Mail className="h-4 w-4" />}
          hint={t("changeEmailHint")}
          action={
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Field error={emailError ?? undefined} className="flex-1">
                <Input
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setEmailError(null);
                  }}
                  placeholder={t("newEmailLabel")}
                  inputMode="email"
                  invalid={!!emailError}
                />
              </Field>
              <Button
                size="sm"
                variant="outline"
                disabled={!newEmail.trim()}
                loading={accountAction.isPending}
                onClick={changeEmail}
                className="sm:self-start"
              >
                {t("changeEmailAction")}
              </Button>
            </div>
          }
        />
      </div>
    </section>
  );
}

function StuckSerial({ detail }: { detail: AdminUserDetail }) {
  const t = useT(adminDict);
  const showToast = useToast();
  const { cancelSerial } = useAdminUserMutations(detail.profile.id);

  return (
    <section className="space-y-3 border-t border-line pt-4">
      <h3 className="text-xs font-bold text-muted uppercase">{t("stuckSerialTitle")}</h3>

      {detail.active_serials.length === 0 ? (
        <p className="text-xs text-muted">{t("noStuckSerial")}</p>
      ) : (
        <>
          <p className="text-xs text-muted">{t("stuckSerialHint")}</p>
          <ul className="space-y-2">
            {detail.active_serials.map((serial) => (
              <li
                key={serial.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-soft px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    <Timer className="mr-1 inline h-3.5 w-3.5" />
                    {serial.shop_name ? t("serialAtShop", serial.shop_name) : "—"}
                  </p>
                  <p className="text-[11px] text-muted">
                    {serial.status} · {formatBanglaDate(new Date(serial.created_at))}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  loading={cancelSerial.isPending}
                  onClick={() =>
                    cancelSerial.mutate(
                      { serialId: serial.id },
                      {
                        onSuccess: () => showToast(t("serialCancelled")),
                        onError: () => showToast(t("serialCancelFailed")),
                      },
                    )
                  }
                >
                  <ShieldAlert className="h-4 w-4" />
                  {t("cancelSerialAction")}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ActionRow({
  icon,
  hint,
  action,
}: {
  icon: React.ReactNode;
  hint: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <p className="flex items-start gap-2 text-xs text-muted sm:max-w-md">
        <span className="mt-0.5 shrink-0 text-muted">{icon}</span>
        {hint}
      </p>
      <div className="shrink-0 sm:max-w-sm">{action}</div>
    </div>
  );
}
