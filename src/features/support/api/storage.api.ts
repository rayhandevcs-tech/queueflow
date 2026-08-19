import { getBrowserClient } from "@/lib/supabase/client";
import { translate } from "@/lib/i18n";
import { compressImage, IMAGE_PRESETS, MAX_SOURCE_BYTES } from "@/lib/image-compress";
import { supportDict } from "../lib/i18n";

const BUCKET = "support-media";

/** A screenshot or two is evidence; a gallery is a different feature. */
export const MAX_TICKET_IMAGES = 3;

function validate(file: File): void {
  if (!file.type.startsWith("image/")) {
    throw new Error(translate(supportDict, "imagesOnlyError"));
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(translate(supportDict, "imageSizeLimitError"));
  }
}

/**
 * Uploads ticket screenshots and returns their public URLs.
 *
 * Path shape: {userId}/{timestamp}-{rand}.{ext} — it matches the
 * storage.objects policy, which only lets someone write into their own folder.
 * The images are uploaded before the ticket exists, which is why the path is
 * keyed on the uploader rather than on a ticket id.
 */
export async function uploadTicketImages(files: File[]): Promise<string[]> {
  if (files.length === 0) return [];
  if (files.length > MAX_TICKET_IMAGES) {
    throw new Error(translate(supportDict, "tooManyImagesError"));
  }
  files.forEach(validate);

  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(translate(supportDict, "uploadFailedError"));

  return Promise.all(
    files.map(async (file) => {
      const image = await compressImage(file, IMAGE_PRESETS.attachment);
      const ext = image.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, image, { cacheControl: "3600", upsert: false });
      if (error) throw new Error(translate(supportDict, "uploadFailedError"));

      return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }),
  );
}
