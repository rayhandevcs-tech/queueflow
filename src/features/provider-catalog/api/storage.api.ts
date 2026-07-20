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
    throw new Error("Only images can be uploaded");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image must be under 2 MB");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${shopId}/${kind}-${Date.now()}.${ext}`;

  const supabase = getBrowserClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) throw new Error("Upload failed — please try again");

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}