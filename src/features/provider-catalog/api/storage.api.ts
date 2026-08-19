import { getBrowserClient } from "@/lib/supabase/client";
import { translate } from "@/lib/i18n";
import { compressImage, IMAGE_PRESETS, MAX_SOURCE_BYTES } from "@/lib/image-compress";
import { providerCatalogDict } from "../lib/i18n";

const BUCKET = "shop-media";

export type UploadKind = "logo" | "cover" | "avatar" | "service";

/** A cover is the only shop image shown edge to edge; the rest are tiles. */
const PRESET_FOR: Record<UploadKind, (typeof IMAGE_PRESETS)[keyof typeof IMAGE_PRESETS]> = {
  logo: IMAGE_PRESETS.tile,
  cover: IMAGE_PRESETS.wide,
  avatar: IMAGE_PRESETS.avatar,
  service: IMAGE_PRESETS.tile,
};

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
    throw new Error(translate(providerCatalogDict, "onlyImagesAllowed"));
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(translate(providerCatalogDict, "imageTooLarge"));
  }

  const image = await compressImage(file, PRESET_FOR[kind]);
  const ext = image.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${shopId}/${kind}-${Date.now()}.${ext}`;

  const supabase = getBrowserClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, image, { cacheControl: "3600", upsert: false });

  if (error) throw new Error(translate(providerCatalogDict, "uploadFailedRetry"));

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
    throw new Error(translate(providerCatalogDict, "onlyImagesAllowed"));
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(translate(providerCatalogDict, "imageTooLarge"));
  }

  const image = await compressImage(file, IMAGE_PRESETS.wide);
  const ext = image.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${shopId}/gallery-${Date.now()}.${ext}`;

  const supabase = getBrowserClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, image, { cacheControl: "3600", upsert: false });

  if (error) throw new Error(translate(providerCatalogDict, "uploadFailedRetry"));

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function deleteShopGalleryStorageObject(path: string): Promise<void> {
  const supabase = getBrowserClient();
  await supabase.storage.from(BUCKET).remove([path]);
}