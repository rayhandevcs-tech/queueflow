import { getBrowserClient } from "@/lib/supabase/client";
import type { NotificationPrefs, Profile, TablesUpdate } from "@/types";
import { translate } from "@/lib/i18n";
import { accountDict } from "../lib/i18n";

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

/**
 * Takes a raw DB patch (not the form's zod output) so the caller decides
 * exactly which keys to include — date_of_birth/address/address_lat/
 * address_lng are new columns (Sprint 22), so ProfileForm only spreads them
 * in when the user actually touched those fields (dirtyFields), the same
 * "safe optional column" discipline as every other new-column rollout in
 * this project. Untouched-field edits (e.g. just changing the name) must
 * never send those keys, or they'd 400 until the migration is live.
 */
export async function updateMyProfile(patch: TablesUpdate<"profiles">): Promise<Profile> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(translate(accountDict, "notLoggedIn"));

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMyAvatar(avatarUrl: string): Promise<Profile> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(translate(accountDict, "notLoggedIn"));

  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMyNotificationPrefs(prefs: NotificationPrefs): Promise<Profile> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(translate(accountDict, "notLoggedIn"));

  const { data, error } = await supabase
    .from("profiles")
    .update({ notification_prefs: prefs })
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Supabase has no direct "verify current password" call, so we
 * re-authenticate with it first — that both confirms it and refreshes the
 * session before the update.
 */
export async function changePassword({
  currentPassword,
  newPassword,
}: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error(translate(accountDict, "notLoggedIn"));

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError) throw reauthError;

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
