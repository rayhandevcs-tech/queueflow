import { getBrowserClient } from "@/lib/supabase/client";

const BUCKET = "review-media";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Upload one review photo and return its public URL.
 * Path shape: {userId}/{timestamp}.{ext} — matches the storage.objects RLS
 * policy, which only allows a user to write into their own folder.
 */
export async function uploadReviewImage(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("শুধু ছবি আপলোড করা যাবে");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("ছবি ২ এমবি-র নিচে হতে হবে");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const supabase = getBrowserClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) throw new Error("আপলোড ব্যর্থ হয়েছে — আবার চেষ্টা করো");

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
