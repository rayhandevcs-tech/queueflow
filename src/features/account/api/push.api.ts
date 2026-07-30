import { getBrowserClient } from "@/lib/supabase/client";
import { translate } from "@/lib/i18n";
import { accountDict } from "../lib/i18n";

/** True if the current device/browser has an active push subscription row. */
export async function hasMyPushSubscription(endpoint: string): Promise<boolean> {
  const supabase = getBrowserClient();
  const { count, error } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("endpoint", endpoint);

  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function saveMyPushSubscription(sub: PushSubscriptionJSON): Promise<void> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(translate(accountDict, "notLoggedIn"));
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    throw new Error(translate(accountDict, "pushSubscribeFailed"));
  }

  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
  });
  if (error) throw error;
}

export async function deleteMyPushSubscription(endpoint: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw error;
}
