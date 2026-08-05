import { getBrowserClient } from "@/lib/supabase/client";

export interface DisplayLane {
  chair_id: string;
  staff_name: string;
  avatar_url: string | null;
  /** Position currently being served on this chair, or null when it's free. */
  now_serving: number | null;
  next_up: number | null;
  waiting: number;
  free_at: string | null;
}

export interface DisplayBoard {
  shop: {
    name: string;
    is_open: boolean;
    accepting_new: boolean;
    break_until: string | null;
    break_reason: string | null;
  };
  lanes: DisplayLane[];
  waiting_total: number;
  /** Minutes until the first chair frees up — the soonest a walk-in could sit. */
  wait_min: number;
  as_of: string;
}

/**
 * The whole screen in one unauthenticated call.
 *
 * Goes through a SECURITY DEFINER RPC rather than reading `queue_public`
 * directly: nobody is signed in on a display, and the RPC returns only what
 * belongs on a wall — position numbers and staff names, no customer identity.
 * Returns null when the shop isn't ACTIVE, so a bad URL can't be used to probe
 * for shops that exist but aren't approved.
 */
export async function getDisplayBoard(shopId: string): Promise<DisplayBoard | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("shop_display_board", { p_shop_id: shopId });

  if (error) throw error;
  return (data as DisplayBoard | null) ?? null;
}
