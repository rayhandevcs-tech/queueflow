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

/**
 * A pick as it comes back from the database.
 *
 * `hairstyle_id` is nullable and the names are snapshots, both since 20260929:
 * the catalogue row a pick points at may since have been renamed, or withdrawn
 * altogether, and neither should change or erase what a customer asked for.
 * Anything historical should read `style_name_*`; the id is only good for
 * looking up a style that still exists (its picture, its description).
 */
export interface StylePick {
  serial_id: string;
  hairstyle_id: string | null;
  note: string | null;
  style_name_bn: string | null;
  style_name_en: string | null;
}

/**
 * What saving a pick needs — which is stricter than what reading one returns.
 * You cannot choose "no style"; that is what clearing the pick is for. The
 * name snapshot is deliberately absent: a trigger fills it from the catalogue,
 * so a caller cannot record a name that disagrees with the id it saved.
 */
export interface StylePickInput {
  serial_id: string;
  hairstyle_id: string;
  note: string | null;
}

/** The pick for the customer's current serial, if they have made one. */
export async function getStylePick(serialId: string): Promise<StylePick | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("serial_style_preferences")
    .select("serial_id, hairstyle_id, note, style_name_bn, style_name_en")
    .eq("serial_id", serialId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * One pick per serial, so changing your mind replaces rather than appends —
 * a barber reading two conflicting preferences would have to guess.
 */
export async function saveStylePick(input: StylePickInput): Promise<void> {
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
