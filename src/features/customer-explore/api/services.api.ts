import { getBrowserClient } from "@/lib/supabase/client";

export interface ActiveServiceRow {
  shop_id: string;
  name: string;
  category: string | null;
}

/** Powers explore's search-by-service-name and the category shortcut row. */
export async function getAllActiveServices(): Promise<ActiveServiceRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("services")
    .select("shop_id, name, category")
    .eq("is_active", true);

  if (error) throw error;
  return data;
}
