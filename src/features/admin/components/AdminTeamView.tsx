"use client";

import { useState } from "react";
import { Plus, ShieldCheck, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { useToast } from "@/components/ui/Toast";
import {
  ADMIN_LEVELS,
  ADMIN_LEVEL_LABEL,
  ADMIN_LEVEL_SCOPE,
} from "@/config/constants";
import { dayLabel } from "@/lib/date-groups";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { AdminLevel } from "@/types";
import { useAdminTeam, useAdminTeamMutations, useMyAdminIdentity } from "../hooks/use-admin";
import { adminDict } from "../lib/i18n";

function NewAdminForm({ onDone }: { onDone: () => void }) {
  const t = useT(adminDict);
  const levelT = useT(ADMIN_LEVEL_LABEL);
  const scopeT = useT(ADMIN_LEVEL_SCOPE);
  const showToast = useToast();
  const { create } = useAdminTeamMutations();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [level, setLevel] = useState<AdminLevel>("MODERATOR");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate(
      { fullName, email, password, level },
      {
        onSuccess: () => {
          showToast(t("adminCreated"));
          onDone();
        },
        onError: (err) => setError(err instanceof Error ? err.message : String(err)),
      },
    );
  };

  return (
    <Card tone="soft" className="p-5">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <p className="font-display text-[15px] font-bold text-ink">{t("addAdminTitle")}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{t("addAdminHint")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("adminNameLabel")}>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} />
          </Field>
          <Field label={t("adminEmailLabel")}>
            <Input
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        </div>

        <Field label={t("adminPasswordLabel")} hint={t("adminPasswordHint")}>
          <PasswordInput
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Field label={t("adminRoleLabel")}>
          <div className="grid gap-2 sm:grid-cols-3">
            {ADMIN_LEVELS.map((value) => {
              const selected = value === level;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLevel(value)}
                  aria-pressed={selected}
                  className={cn(
                    "rounded-2xl border p-3 text-left transition-all duration-150",
                    "focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none",
                    selected
                      ? "border-accent bg-accent/[0.07] shadow-xs"
                      : "border-line bg-card hover:border-line/80 hover:bg-soft",
                  )}
                >
                  <p
                    className={cn(
                      "text-[13px] font-bold",
                      selected ? "text-accent" : "text-ink",
                    )}
                  >
                    {levelT(value)}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">{scopeT(value)}</p>
                </button>
              );
            })}
          </div>
        </Field>

        {error && (
          <p
            role="alert"
            className="rounded-[14px] border border-live/25 bg-live-soft px-3.5 py-2.5 text-sm font-medium text-live"
          >
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" loading={create.isPending}>
            {create.isPending ? t("creatingAdmin") : t("createAdminCta")}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            {t("cancelLabel")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function AdminTeamView() {
  const t = useT(adminDict);
  const levelT = useT(ADMIN_LEVEL_LABEL);
  const { data: identity } = useMyAdminIdentity();
  const { data: admins, isPending } = useAdminTeam();
  const { changeStatus, changeLevel, revoke } = useAdminTeamMutations();
  const [adding, setAdding] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const isSuper = identity?.level === "SUPER_ADMIN";

  return (
    <div className="space-y-5">
      <PageHeader title={t("teamTitle")} description={t("teamSubtitle")} />

      {isSuper ? (
        adding ? (
          <NewAdminForm onDone={() => setAdding(false)} />
        ) : (
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            {t("addAdmin")}
          </Button>
        )
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-[13px] text-muted">
          {t("onlySuperAdmin")}
        </p>
      )}

      {isPending ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-3xl" />
          ))}
        </div>
      ) : !admins || admins.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title={t("noAdminsTitle")} />
      ) : (
        <div className="space-y-2.5">
          {admins.map((row) => {
            const isMe = row.user_id === identity?.user_id;
            const disabled = row.status === "DISABLED";
            return (
              <Card key={row.user_id} className={cn("p-4", disabled && "opacity-70")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-[15px] font-bold text-ink">
                        {row.full_name ?? "—"}
                      </p>
                      {isMe && (
                        <span className="rounded-full bg-soft px-2 py-0.5 text-[10px] font-bold text-muted">
                          {t("youBadge")}
                        </span>
                      )}
                      <StatusPill
                        tone={disabled ? "neutral" : "good"}
                        label={levelT(row.level)}
                        dot={false}
                      />
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-muted">{row.email ?? ""}</p>
                    <p className="mt-1.5 text-[11px] text-muted">
                      {row.last_sign_in
                        ? `${t("lastSignIn")}: ${dayLabel(row.last_sign_in)}`
                        : t("neverSignedIn")}
                    </p>
                  </div>

                  {/* Nothing is offered against your own row: disabling or
                      demoting yourself is how a panel loses its last super
                      admin, and the RPCs reject it anyway. */}
                  {isSuper && !isMe && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={row.level}
                        onChange={(e) =>
                          changeLevel.mutate({
                            userId: row.user_id,
                            level: e.target.value as AdminLevel,
                          })
                        }
                        aria-label={t("adminRoleLabel")}
                        className="min-h-11 rounded-[14px] border border-line bg-soft px-3 text-[13px] font-semibold text-ink focus:border-accent focus:bg-card focus:ring-4 focus:ring-accent/12 focus:outline-none"
                      >
                        {ADMIN_LEVELS.map((value) => (
                          <option key={value} value={value}>
                            {levelT(value)}
                          </option>
                        ))}
                      </select>

                      <Button
                        size="sm"
                        variant="soft"
                        loading={changeStatus.isPending}
                        onClick={() =>
                          changeStatus.mutate({
                            userId: row.user_id,
                            status: disabled ? "ACTIVE" : "DISABLED",
                          })
                        }
                      >
                        {disabled ? t("enableAdmin") : t("disableAdmin")}
                      </Button>

                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setRevoking(row.user_id)}
                      >
                        <UserRoundX className="h-3.5 w-3.5" />
                        {t("revokeAdmin")}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmSheet
        open={!!revoking}
        title={t("revokeAdmin")}
        description={t("revokeAdminConfirm")}
        confirmLabel={t("revokeAdmin")}
        loading={revoke.isPending}
        onConfirm={() => {
          if (revoking) revoke.mutate(revoking, { onSuccess: () => setRevoking(null) });
        }}
        onCancel={() => setRevoking(null)}
      />
    </div>
  );
}
