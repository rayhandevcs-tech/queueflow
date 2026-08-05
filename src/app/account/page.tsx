"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, ChevronLeft, HelpCircle, LogOut, ScrollText, Shield, Undo2 } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { uploadUserAvatar } from "@/lib/avatar-storage";
import { useMyProfile } from "@/features/account/hooks/use-my-profile";
import { useUpdateMyAvatar } from "@/features/account/hooks/use-profile-mutations";
import { ProfileForm } from "@/features/account/components/ProfileForm";
import { ChangePasswordForm } from "@/features/account/components/ChangePasswordForm";
import { DeleteAccountSection } from "@/features/account/components/DeleteAccountSection";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { ROLES, ROLE_LABEL } from "@/config/constants";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProfileHeaderCard } from "@/components/ui/ProfileHeaderCard";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { Spinner } from "@/components/ui/Spinner";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { useT, useLanguage } from "@/lib/i18n";
import { accountDict } from "@/features/account/lib/i18n";
import { CustomerShell } from "@/app/(customer)/_components/CustomerShell";
import { ProviderShell } from "@/app/(provider)/_components/ProviderShell";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-[13px] font-semibold tracking-wide text-muted uppercase">{children}</p>;
}

function AccountContent({ backHref }: { backHref: string }) {
  const { data: profile, isPending } = useMyProfile();
  const updateAvatar = useUpdateMyAvatar();
  const logout = useLogout();
  const showToast = useToast();
  const [email, setEmail] = useState<string | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const { language, setLanguage } = useLanguage();
  const t = useT(accountDict);
  const roleT = useT(ROLE_LABEL);

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (!profile) {
    return <p className="text-sm text-ink">{t("profileLoadFailed")}</p>;
  }

  async function onAvatarFileSelected(file: File) {
    setAvatarUploading(true);
    try {
      const url = await uploadUserAvatar(profile!.id, file);
      updateAvatar.mutate(url);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("saveFailed"));
    } finally {
      setAvatarUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href={backHref}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-soft"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-xl font-bold text-ink">{t("accountTitle")}</h1>
      </div>

      <ProfileHeaderCard
        name={profile.full_name || t("noName")}
        subtitle={email ?? "—"}
        avatarUrl={profile.avatar_url}
        onAvatarFileSelected={onAvatarFileSelected}
        avatarUploading={avatarUploading}
        right={
          <Badge variant="accent" className="shrink-0 bg-white shadow-xs">
            {roleT(profile.role)}
          </Badge>
        }
      />

      {/* প্রোফাইল */}
      <div className="mt-4 rounded-[18px] border border-line bg-card p-5">
        <SectionHeading>{t("profileInfoSection")}</SectionHeading>
        <ProfileForm profile={profile} />
      </div>

      {/* নিরাপত্তা */}
      <div className="mt-4 rounded-[18px] border border-line bg-card p-5">
        <SectionHeading>{t("securitySection")}</SectionHeading>
        <ChangePasswordForm />
      </div>

      {/* প্রেফারেন্স */}
      <div className="mt-4 rounded-[18px] border border-line bg-card p-5">
        <SectionHeading>{t("preferencesSection")}</SectionHeading>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setLanguage("bn")}
            className={cn(
              "rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all",
              language === "bn"
                ? "border-accent bg-accent text-accent-ink shadow-sm"
                : "border-line bg-card text-muted hover:border-accent/40 hover:bg-soft",
            )}
          >
            {t("languageBn")}
          </button>
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={cn(
              "rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all",
              language === "en"
                ? "border-accent bg-accent text-accent-ink shadow-sm"
                : "border-line bg-card text-muted hover:border-accent/40 hover:bg-soft",
            )}
          >
            {t("languageEn")}
          </button>
        </div>
        <div className="mt-2">
          <SettingsRow href="/notification-settings" icon={<Bell className="h-4.5 w-4.5" />} label={t("notificationSettings")} />
        </div>
      </div>

      {/* সাপোর্ট */}
      <div className="mt-4 rounded-[18px] border border-line bg-card p-2">
        <SettingsRow href="/help" icon={<HelpCircle className="h-4.5 w-4.5" />} label={t("helpCenter")} />
        <SettingsRow href="/privacy" icon={<Shield className="h-4.5 w-4.5" />} label={t("privacyPolicy")} />
        <SettingsRow href="/terms" icon={<ScrollText className="h-4.5 w-4.5" />} label={t("termsOfUse")} />
        <SettingsRow href="/cancellation-policy" icon={<Undo2 className="h-4.5 w-4.5" />} label={t("cancellationPolicy")} />
      </div>

      <Button
        variant="danger"
        size="lg"
        onClick={() => setLogoutConfirmOpen(true)}
        className="mt-4 w-full"
      >
        <LogOut className="h-4 w-4" />
        {t("logout")}
      </Button>

      {/* ডেঞ্জার জোন */}
      <div className="mt-4 rounded-[18px] border border-live/30 bg-card p-5">
        <SectionHeading>{t("dangerZoneSection")}</SectionHeading>
        <DeleteAccountSection />
      </div>

      <ConfirmSheet
        open={logoutConfirmOpen}
        title={t("logoutConfirmTitle")}
        description={t("logoutConfirmDescription")}
        confirmLabel={t("logoutConfirmCta")}
        cancelLabel={t("stay")}
        loading={logout.isPending}
        onConfirm={() => logout.mutate()}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
    </div>
  );
}

export default function AccountPage() {
  const { data: profile, isPending } = useMyProfile();

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (profile?.role === ROLES.PROVIDER) {
    return (
      <ProviderShell>
        <AccountContent backHref="/dashboard" />
      </ProviderShell>
    );
  }

  return (
    <CustomerShell>
      <AccountContent backHref="/profile" />
    </CustomerShell>
  );
}
