import { getBrowserClient } from "@/lib/supabase/client";

const BUCKET = "shop-media";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export type UploadKind = "logo" | "cover" | "avatar";

/**
 * Upload an image to Supabase Storage and return its public URL.
 * Path shape: {shopId}/{kind}-{timestamp}.{ext} — timestamped so a new
 * upload never fights the CDN cache of the old one.
 */
export async function uploadShopImage(
  shopId: string,
  kind: UploadKind,
  file: File,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("শুধু ছবি আপলোড করা যাবে");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("ছবি ২ এমবি-র নিচে হতে হবে");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${shopId}/${kind}-${Date.now()}.${ext}`;

  const supabase = getBrowserClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) throw new Error("আপলোড ব্যর্থ হয়েছে — আবার চেষ্টা করো");

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Upload one gallery photo. Unlike uploadShopImage this also returns the
 * storage path (not just the public URL), so a later delete can remove the
 * object as well as its `shop_gallery_images` row.
 */
export async function uploadShopGalleryImage(
  shopId: string,
  file: File,
): Promise<{ url: string; path: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("শুধু ছবি আপলোড করা যাবে");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("ছবি ২ এমবি-র নিচে হতে হবে");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${shopId}/gallery-${Date.now()}.${ext}`;

  const supabase = getBrowserClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) throw new Error("আপলোড ব্যর্থ হয়েছে — আবার চেষ্টা করো");

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function deleteShopGalleryStorageObject(path: string): Promise<void> {
  const supabase = getBrowserClient();
  await supabase.storage.from(BUCKET).remove([path]);
}