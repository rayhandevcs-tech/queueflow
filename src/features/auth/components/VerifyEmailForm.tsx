"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";
import { useT } from "@/lib/i18n";
import { useVerifyEmail, useResendCode } from "../hooks/use-verify-email";
import { translateAuthError } from "@/lib/auth-errors";
import { authDict } from "../lib/i18n";

const RESEND_COOLDOWN_S = 30;

export function VerifyEmailForm({ email }: { email: string }) {
  const router = useRouter();
  const t = useT(authDict);
  const verify = useVerifyEmail();
  const resend = useResendCode();
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const onVerify = () => {
    verify.mutate(
      { email, token: code },
      {
        onSuccess: () => {
          router.replace("/complete-profile");
          router.refresh();
        },
      },
    );
  };

  const onResend = () => {
    resend.mutate(email, { onSuccess: () => setCooldown(RESEND_COOLDOWN_S) });
  };

  return (
    <div className="w-full space-y-5">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-good-soft text-good">
        <MailCheck className="h-7 w-7" />
      </div>

      <p className="text-center text-sm font-medium text-ink">{t("verifyEmailCodeSentTo", email)}</p>

      <OtpInput value={code} onChange={setCode} disabled={verify.isPending} invalid={verify.isError} />

      <Button
        type="button"
        size="lg"
        className="w-full"
        loading={verify.isPending}
        disabled={code.length !== 6}
        onClick={onVerify}
      >
        {verify.isPending ? t("verifying") : t("verifyCta")}
      </Button>

      {verify.isError && (
        <p className="text-center text-sm text-live">{translateAuthError(verify.error)}</p>
      )}

      <div className="text-center text-sm">
        {cooldown > 0 ? (
          <span className="text-muted">{t("resendIn", cooldown)}</span>
        ) : (
          <button
            type="button"
            onClick={onResend}
            disabled={resend.isPending}
            className="font-semibold text-accent hover:underline disabled:opacity-50"
          >
            {t("resendCode")}
          </button>
        )}
        {resend.isSuccess && cooldown === RESEND_COOLDOWN_S && (
          <p className="mt-1 text-xs text-good">{t("codeResent")}</p>
        )}
      </div>

      {/* Both doors work: the 6-digit code typed here, and the link in the
          mail, which lands on /auth/callback. Saying so keeps people from
          getting stuck when the mail template ships one and not the other. */}
      <p className="text-center text-xs leading-relaxed text-muted">
        {t("verifyLinkAlternative")}
      </p>

      <p className="text-center text-sm text-muted">
        <Link href="/register" className="font-semibold text-accent hover:underline">
          {t("wrongEmailGoBack")}
        </Link>
      </p>
    </div>
  );
}
