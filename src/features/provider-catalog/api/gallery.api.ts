import { getBrowserClient } from "@/lib/supabase/client";
import type { ShopGalleryImage } from "@/types";

export async function getMyShopGallery(shopId: string): Promise<ShopGalleryImage[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("shop_gallery_images")
    .select("*")
    .eq("shop_id", shopId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function addGalleryImage(
  shopId: string,
  image: { url: string; path: string },
  sortOrder: number,
): Promise<ShopGalleryImage> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("shop_gallery_images")
    .insert({ shop_id: shopId, url: image.url, path: image.path, sort_order: sortOrder })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteGalleryImage(imageId: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.from("shop_gallery_images").delete().eq("id", imageId);
  if (error) throw error;
}
