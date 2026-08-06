import { getBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types";
import type { LoginFormValues } from "../schemas/login.schema";
import type { RegisterFormValues } from "../schemas/register.schema";
import type { ForgotPasswordFormValues } from "../schemas/forgot-password.schema";

/**
 * Whether the signed-in session belongs to a platform admin, asked of the
 * database rather than of the token.
 *
 * app_metadata carries an is_admin claim for middleware's benefit, but a claim
 * is a snapshot: it survives a revoked membership until the next refresh. Both
 * login paths below branch on this instead, so revoking an admin takes effect
 * on their very next sign-in.
 */
async function isActiveAdmin(supabase: ReturnType<typeof getBrowserClient>) {
  const { data } = await supabase.rpc("my_admin_identity");
  return (data?.length ?? 0) > 0;
}

/**
 * The customer / shop-owner login.
 *
 * An admin account is refused here on purpose. Since Sprint 36 an admin is a
 * separate identity — no profile, no shop, no customer history — so signing one
 * in through this door would land it in an app that has nothing to show it.
 * The session is torn down again before throwing, so a rejected attempt leaves
 * no half-authenticated state behind.
 */
export async function signIn(values: LoginFormValues): Promise<{ role: UserRole }> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword(values);
  if (error) throw error;

  if (await isActiveAdmin(supabase)) {
    await supabase.auth.signOut();
    throw new Error("ADMIN_ACCOUNT");
  }

  const role = (data.user.user_metadata?.role as UserRole | undefined) ?? "customer";
  return { role };
}

/**
 * The admin login, served at /admin/login.
 *
 * Same credential store, different door: anything that is not an active admin
 * is signed straight back out, so this screen cannot be used to log into the
 * customer app and cannot be probed to find out which addresses are admins —
 * a disabled admin and an ordinary customer get the identical message.
 */
export async function signInAdmin(values: LoginFormValues): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.auth.signInWithPassword(values);
  if (error) throw error;

  if (!(await isActiveAdmin(supabase))) {
    await supabase.auth.signOut();
    throw new Error("NOT_ADMIN");
  }
}

/**
 * Applies the phone number carried in user_metadata to the profiles row.
 * Called right after signUp() when a session comes back immediately (email
 * confirmation disabled on this project), and again after verifyEmailCode()
 * when confirmation is required — whichever path actually yields a session
 * does the write, so phone lands on profiles.phone exactly once either way.
 */
async function applyPendingPhone(
  supabase: ReturnType<typeof getBrowserClient>,
  user: { id: string; user_metadata?: Record<string, unknown> } | null | undefined,
) {
  const phone = user?.user_metadata?.phone as string | undefined;
  if (phone && user) {
    await supabase.from("profiles").update({ phone }).eq("id", user.id);
  }
}

/**
 * Where a confirmation or recovery link should come back to.
 *
 * Supabase falls back to the project's Site URL when this isn't given, which
 * is how a production signup ends up mailing a link to http://localhost:3000.
 * Passing the live origin explicitly means the link always points at the site
 * the person actually signed up on. /auth/callback is what turns that link
 * into a session — see the route's own comment.
 */
function authCallbackUrl(next?: string): string {
  const base = `${window.location.origin}/auth/callback`;
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}

export async function signUp(
  values: RegisterFormValues,
): Promise<{ role: UserRole; needsEmailConfirmation: boolean }> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      emailRedirectTo: authCallbackUrl(),
      // Read by the DB trigger that provisions the (role-immutable) profile row.
      // phone/business_type aren't consumed by that trigger yet — they're carried
      // in user_metadata and applied below (or after verify-email, see verifyEmailCode).
      data: {
        role: values.role,
        full_name: values.fullName,
        phone: values.phone,
        business_type: values.businessType ?? null,
      },
    },
  });
  if (error) throw error;

  if (data.session) await applyPendingPhone(supabase, data.user);

  return { role: values.role, needsEmailConfirmation: !data.session };
}

/** Verifies the 6-digit signup code and applies the phone number carried in user_metadata. */
export async function verifyEmailCode({
  email,
  token,
}: {
  email: string;
  token: string;
}): Promise<{ role: UserRole }> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });
  if (error) throw error;

  await applyPendingPhone(supabase, data.user);

  const role = (data.user?.user_metadata?.role as UserRole | undefined) ?? "customer";
  return { role };
}

export async function resendVerificationCode(email: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: authCallbackUrl() },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset({
  email,
}: ForgotPasswordFormValues): Promise<void> {
  const supabase = getBrowserClient();
  // Through the callback, not straight at /reset-password: under PKCE the
  // recovery link arrives as a `code` that has to be exchanged server-side,
  // and /reset-password only knows how to use a session that already exists.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authCallbackUrl("/reset-password"),
  });
  if (error) throw error;
}

/** Called from /reset-password, where a recovery session is already active. */
export async function updatePassword(newPassword: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
