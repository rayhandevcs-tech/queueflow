"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useT, type Dict } from "@/lib/i18n";

const dict = {
  title: { bn: "লগইন প্রয়োজন", en: "Login required" },
  body: {
    bn: "এই ফিচারটি ব্যবহার করতে একটি অ্যাকাউন্ট প্রয়োজন।",
    en: "You need an account to use this feature.",
  },
  login: { bn: "লগইন করুন", en: "Log in" },
  register: { bn: "নতুন অ্যাকাউন্ট তৈরি করুন", en: "Create an account" },
  cancel: { bn: "বাতিল", en: "Cancel" },
} satisfies Dict;

interface AuthGateValue {
  signedIn: boolean;
  /**
   * Wraps an action so it only runs for someone signed in. A guest gets the
   * dialog instead — never an error, a toast or a failed request.
   *
   *   <Button onClick={guard(() => book())}>বুক করো</Button>
   *
   * `reason` lets a caller name the feature in the dialog. Returns a handler,
   * so it drops straight into onClick without a wrapper function at the call
   * site.
   */
  guard: <A extends unknown[]>(action: (...args: A) => void, reason?: string) => (...args: A) => void;
}

/**
 * Outside the provider — the provider and admin apps, where every route
 * already requires a session — there is nobody to gate, so guard() is the
 * identity function. That keeps shared components usable in all three apps
 * without each of them having to mount a gate they don't need.
 */
const AuthGateContext = createContext<AuthGateValue>({
  signedIn: true,
  guard: (action) => action,
});

export function useAuthGate() {
  return useContext(AuthGateContext);
}

/**
 * Action-based authentication.
 *
 * Guests are allowed to browse the whole catalogue — shops, map, services,
 * reviews, photos, live queue — and are only stopped at the point where an
 * action genuinely needs an account. That decision lives here, in one place,
 * rather than in each button: the alternative is a dozen components each
 * inventing their own way to say "please log in", and drifting apart.
 *
 * `signedIn` is passed down from a server component, so the first paint is
 * already correct — no session sniffing on the client, no flash of the wrong
 * chrome, nothing to hydrate differently than it rendered.
 */
export function AuthGateProvider({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const guard = useCallback<AuthGateValue["guard"]>(
    (action, actionReason) =>
      (...args) => {
        if (signedIn) {
          action(...args);
          return;
        }
        setReason(actionReason ?? null);
        setOpen(true);
      },
    [signedIn],
  );

  const value = useMemo(() => ({ signedIn, guard }), [signedIn, guard]);

  return (
    <AuthGateContext.Provider value={value}>
      {children}
      <LoginRequiredDialog open={open} reason={reason} onClose={() => setOpen(false)} />
    </AuthGateContext.Provider>
  );
}

/**
 * Exported so a screen can show the same prompt without an action behind it
 * (an empty state that exists only because you are not signed in, say).
 * Everything routine should go through guard() instead.
 */
export function LoginRequiredDialog({
  open,
  reason,
  onClose,
}: {
  open: boolean;
  reason?: string | null;
  onClose: () => void;
}) {
  const t = useT(dict);
  const pathname = usePathname();

  // Come back to where the action was, not to a generic home — the person
  // was in the middle of something.
  const next = pathname && pathname.startsWith("/") ? `?next=${encodeURIComponent(pathname)}` : "";

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="space-y-2 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
          <Lock className="h-5.5 w-5.5" />
        </span>
        <h2 className="font-display text-lg font-bold text-ink">{t("title")}</h2>
        <p className="text-sm leading-relaxed text-muted">{reason ?? t("body")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Link
          href={`/login${next}`}
          className="grid min-h-11 place-items-center rounded-[14px] bg-accent px-4 text-sm font-bold text-accent-ink hover:opacity-90"
        >
          {t("login")}
        </Link>
        <Link
          href={`/register${next}`}
          className="grid min-h-11 place-items-center rounded-[14px] border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-soft"
        >
          {t("register")}
        </Link>
        <Button variant="ghost" onClick={onClose}>
          {t("cancel")}
        </Button>
      </div>
    </BottomSheet>
  );
}
