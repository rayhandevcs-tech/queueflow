import { getBrowserClient } from "@/lib/supabase/client";
import { translate } from "@/lib/i18n";
import { supportDict } from "../lib/i18n";

const BUCKET = "support-media";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB, same ceiling as chat images

/** A screenshot or two is evidence; a gallery is a different feature. */
export const MAX_TICKET_IMAGES = 3;

function validate(file: File): void {
  if (!file.type.startsWith("image/")) {
    throw new Error(translate(supportDict, "imagesOnlyError"));
  }
  if (file.size > MAX_BYTES) {
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
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw new Error(translate(supportDict, "uploadFailedError"));

      return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }),
  );
}
