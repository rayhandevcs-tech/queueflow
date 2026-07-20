import { getBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types";
import type { LoginFormValues } from "../schemas/login.schema";
import type { RegisterFormValues } from "../schemas/register.schema";

export async function signIn(values: LoginFormValues): Promise<{ role: UserRole }> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword(values);
  if (error) throw error;

  const role = (data.user.user_metadata?.role as UserRole | undefined) ?? "customer";
  return { role };
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
      data: { role: values.role, full_name: values.fullName },
    },
  });
  if (error) throw error;

  return { role: values.role, needsEmailConfirmation: !data.session };
}

export async function signOut(): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
