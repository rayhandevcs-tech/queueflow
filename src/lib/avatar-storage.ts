import { getBrowserClient } from "@/lib/supabase/client";

const BUCKET = "avatars";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Upload a user's profile photo and return its public URL.
 * Path shape: {userId}/{timestamp}.{ext} — the userId prefix is what the
 * bucket's storage.objects RLS policy checks against auth.uid().
 */
export async function uploadUserAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("শুধু ছবি আপলোড করা যাবে");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("ছবি ২ MB-এর কম হতে হবে");
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
