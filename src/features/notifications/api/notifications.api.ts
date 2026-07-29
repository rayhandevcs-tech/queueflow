import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
import type { Notification } from "@/types";

export async function getMyNotifications(userId: string): Promise<Notification[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .is("read_at", null);

    if (error) throw error;
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);

    if (error) throw error;
  });
}

export type BroadcastTarget = "recent" | "regulars";

export async function sendBroadcast(payload: {
  shopId: string;
  target: BroadcastTarget;
  title: string;
  body: string;
}): Promise<number> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc("broadcast_shop_notification", {
      p_shop_id: payload.shopId,
      p_target: payload.target,
      p_title: payload.title,
      p_body: payload.body,
    });

    if (error) throw error;
    return data ?? 0;
  });
}
