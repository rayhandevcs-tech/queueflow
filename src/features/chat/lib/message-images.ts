import type { Message } from "@/types";

export function getMessageImageUrls(
  message: Pick<Message, "image_url" | "image_urls">,
): string[] {
  if (message.image_urls?.length) return message.image_urls;
  if (message.image_url) return [message.image_url];
  return [];
}
