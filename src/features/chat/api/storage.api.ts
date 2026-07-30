import { getBrowserClient } from "@/lib/supabase/client";
import { translate } from "@/lib/i18n";
import { chatDict } from "../lib/i18n";

const BUCKET = "chat-media";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Upload an image shared inside a chat thread and return its public URL.
 * Path shape: {shopId}/{customerId}/{timestamp}.{ext} — matches the
 * storage.objects RLS policy, which allows the thread's customer or the
 * shop's owner to write into that folder.
 */
export async function uploadChatImage(
  shopId: string,
  customerId: string,
  file: File,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error(translate(chatDict, "imagesOnlyError"));
  }
  if (file.size > MAX_BYTES) {
    throw new Error(translate(chatDict, "imageSizeLimitError"));
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${shopId}/${customerId}/${Date.now()}.${ext}`;

  const supabase = getBrowserClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) throw new Error(translate(chatDict, "uploadFailedError"));

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
