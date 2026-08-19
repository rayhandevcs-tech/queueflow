import { getBrowserClient } from "@/lib/supabase/client";
import { translate, type Dict } from "@/lib/i18n";
import { compressImage, IMAGE_PRESETS, MAX_SOURCE_BYTES } from "@/lib/image-compress";

const BUCKET = "avatars";

const dict = {
  onlyImagesAllowed: { bn: "শুধু ছবি আপলোড করা যাবে", en: "Only images can be uploaded" },
  imageTooLarge: {
    bn: "ছবিটা অনেক বড় — ৪০ MB-এর কম হতে হবে",
    en: "That image is too large — it must be under 40 MB",
  },
  uploadFailedRetry: { bn: "আপলোড ব্যর্থ হয়েছে — আবার চেষ্টা করো", en: "Upload failed — try again" },
} satisfies Dict;

/**
 * Upload a user's profile photo and return its public URL.
 * Path shape: {userId}/{timestamp}.{ext} — the userId prefix is what the
 * bucket's storage.objects RLS policy checks against auth.uid().
 */
export async function uploadUserAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error(translate(dict, "onlyImagesAllowed"));
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(translate(dict, "imageTooLarge"));
  }

  const image = await compressImage(file, IMAGE_PRESETS.avatar);
  const ext = image.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const supabase = getBrowserClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, image, { cacheControl: "3600", upsert: false });

  if (error) throw new Error(translate(dict, "uploadFailedRetry"));

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
