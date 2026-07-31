import { getBrowserClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";
import type { CompleteProfileFormOutput } from "../schemas/complete-profile.schema";

export async function completeOnboarding(
  values: CompleteProfileFormOutput,
): Promise<Profile> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("লগইন করা নেই");

  const { data, error } = await supabase
    .from("profiles")
    .update({
      gender: values.gender,
      avatar_url: values.avatarUrl,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function skipOnboarding(): Promise<void> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("লগইন করা নেই");

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) throw error;
}
