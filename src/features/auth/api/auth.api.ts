import { getBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types";
import type { LoginFormValues } from "../schemas/login.schema";
import type { RegisterFormValues } from "../schemas/register.schema";
import type { ForgotPasswordFormValues } from "../schemas/forgot-password.schema";

export async function signIn(values: LoginFormValues): Promise<{ role: UserRole }> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword(values);
  if (error) throw error;

  const role = (data.user.user_metadata?.role as UserRole | undefined) ?? "customer";
  return { role };
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

export async function signUp(
  values: RegisterFormValues,
): Promise<{ role: UserRole; needsEmailConfirmation: boolean }> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
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
  const { error } = await supabase.auth.resend({ type: "signup", email });
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
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

/** Called from /reset-password, where a recovery session is already active. */
export async function updatePassword(newPassword: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
