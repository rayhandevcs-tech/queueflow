import { getBrowserClient } from "@/lib/supabase/client";
import type { Hairstyle } from "@/types";

export type { Hairstyle };
export type StyleKind = "HAIR" | "BEARD";

export async function getHairstyles(kind: StyleKind): Promise<Hairstyle[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("hairstyles")
    .select("*")
    .eq("is_active", true)
    .eq("kind", kind)
    .order("sort_order");

  if (error) throw error;
  return data;
}

export interface StylePick {
  serial_id: string;
  hairstyle_id: string;
  note: string | null;
}

/** The pick for the customer's current serial, if they have made one. */
export async function getStylePick(serialId: string): Promise<StylePick | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("serial_style_preferences")
    .select("serial_id, hairstyle_id, note")
    .eq("serial_id", serialId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * One pick per serial, so changing your mind replaces rather than appends —
 * a barber reading two conflicting preferences would have to guess.
 */
export async function saveStylePick(input: StylePick): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase
    .from("serial_style_preferences")
    .upsert(input, { onConflict: "serial_id" });

  if (error) throw error;
}

export async function clearStylePick(serialId: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase
    .from("serial_style_preferences")
    .delete()
    .eq("serial_id", serialId);

  if (error) throw error;
}
