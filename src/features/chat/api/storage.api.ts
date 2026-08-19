import { getBrowserClient } from "@/lib/supabase/client";
import { translate } from "@/lib/i18n";
import { compressImage, IMAGE_PRESETS, MAX_SOURCE_BYTES } from "@/lib/image-compress";
import { chatDict } from "../lib/i18n";

const BUCKET = "chat-media";

/** Reasonable cap for a single message's image grid, not a product requirement. */
export const MAX_CHAT_IMAGES_PER_MESSAGE = 6;

function validateChatImage(file: File): void {
  if (!file.type.startsWith("image/")) {
    throw new Error(translate(chatDict, "imagesOnlyError"));
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(translate(chatDict, "imageSizeLimitError"));
  }
}

async function uploadOneChatImage(
  shopId: string,
  customerId: string,
  file: File,
): Promise<string> {
  const image = await compressImage(file, IMAGE_PRESETS.attachment);
  const ext = image.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${shopId}/${customerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const supabase = getBrowserClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, image, { cacheControl: "3600", upsert: false });

  if (error) throw new Error(translate(chatDict, "uploadFailedError"));

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Upload one or more images shared inside a chat thread and return their
 * public URLs. Path shape: {shopId}/{customerId}/{timestamp}-{rand}.{ext} —
 * matches the storage.objects RLS policy, which allows the thread's customer
 * or the shop's owner to write into that folder. The random suffix keeps
 * multiple images picked in the same message from colliding on the same
 * millisecond timestamp.
 */
export async function uploadChatImages(
  shopId: string,
  customerId: string,
  files: File[],
): Promise<string[]> {
  if (files.length > MAX_CHAT_IMAGES_PER_MESSAGE) {
    throw new Error(translate(chatDict, "tooManyImagesError"));
  }
  files.forEach(validateChatImage);
  return Promise.all(files.map((file) => uploadOneChatImage(shopId, customerId, file)));
}

export async function uploadChatImage(
  shopId: string,
  customerId: string,
  file: File,
): Promise<string> {
  const [url] = await uploadChatImages(shopId, customerId, [file]);
  return url;
}
