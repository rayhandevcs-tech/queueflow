import { getBrowserClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";
import type { ProfileFormOutput } from "../schemas/profile.schema";

export async function getMyProfile(): Promise<Profile | null> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateMyProfile(values: ProfileFormOutput): Promise<Profile> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: values.fullName, phone: values.phone })
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
