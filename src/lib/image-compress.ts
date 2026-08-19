/**
 * Shrink a picked image before it ever reaches Storage.
 *
 * Six upload paths each enforced their own 2 MB ceiling, which meant a photo
 * straight off a phone camera — routinely 4–12 MB — was simply rejected, and
 * the shopkeeper's only recourse was to find an image editor. Rejecting the
 * user's photo is the worst possible answer to a problem the browser can solve
 * in a few hundred milliseconds.
 *
 * So the limit is no longer the first thing an upload meets. The image is
 * decoded, scaled down to a sensible longest edge, and re-encoded as WebP,
 * which typically turns those 4–12 MB into 100–400 KB at a quality nobody can
 * tell apart on a phone screen. Storage cost drops with it.
 *
 * The ceiling still exists, but it now applies to the compressed result, so it
 * is a safety net rather than a gate.
 */

export interface CompressPreset {
  /** Longest edge, in CSS pixels. Anything smaller is left at its own size. */
  maxDimension: number;
  /** WebP quality for the first attempt, 0–1. */
  quality: number;
  /** Hard ceiling for the result. Quality steps down until it fits. */
  maxBytes: number;
}

/**
 * One place for "how big should this kind of image be", so a service photo and
 * a chat photo can't quietly drift apart.
 */
export const IMAGE_PRESETS = {
  /** Profile and staff photos — always rendered small and round. */
  avatar: { maxDimension: 512, quality: 0.82, maxBytes: 400 * 1024 },
  /** Service cards, shop logos — a square tile at most. */
  tile: { maxDimension: 900, quality: 0.82, maxBytes: 600 * 1024 },
  /** Cover images and gallery photos — the only ones shown edge to edge. */
  wide: { maxDimension: 1600, quality: 0.8, maxBytes: 1024 * 1024 },
  /** Chat, review and support attachments — read at arm's length. */
  attachment: { maxDimension: 1400, quality: 0.8, maxBytes: 800 * 1024 },
} as const satisfies Record<string, CompressPreset>;

export type PresetName = keyof typeof IMAGE_PRESETS;

/**
 * Absolute cap on what we will even try to decode. Not a quality judgement —
 * a 60 MP RAW would pin the main thread for seconds and can still fail, and
 * telling someone that up front beats a frozen tab.
 */
export const MAX_SOURCE_BYTES = 40 * 1024 * 1024;

/** Formats a byte count the way the error messages talk about size. */
export function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0);
}

/**
 * Scale a w×h box down so its longest edge is at most `max`, keeping the
 * aspect ratio and never scaling up. Pure, so the arithmetic that decides how
 * an image is resampled is testable without a canvas.
 */
export function fitDimensions(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max || longest === 0) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * True when re-encoding is pointless or destructive.
 *
 * - GIF: a canvas keeps only the first frame, so compressing would silently
 *   throw away the animation. Better to pass it through and let the size cap
 *   decide.
 * - SVG: already tiny, and rasterising it defeats the point.
 */
export function shouldSkipCompression(type: string): boolean {
  return type === "image/gif" || type === "image/svg+xml";
}

/** Swaps the extension so the stored filename matches what's inside it. */
function toWebpName(name: string): string {
  return `${name.replace(/\.[^.]+$/, "") || "image"}.webp`;
}

async function encode(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/webp", quality);
  });
}

/**
 * Compress `file` according to `preset`, returning a new File — or the
 * original when compression is impossible or simply didn't help.
 *
 * Never throws for image reasons: if the browser cannot decode the format
 * (HEIC in some browsers, a corrupt file), the original comes back and the
 * caller's size check gives the user a plain message. Silently uploading
 * something worse than what was picked is the one outcome worth avoiding, so a
 * result that came out larger than the source is discarded.
 */
export async function compressImage(
  file: File,
  preset: CompressPreset,
): Promise<File> {
  if (shouldSkipCompression(file.type)) return file;
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // undecodable here — let the size check speak instead
  }

  try {
    const { width, height } = fitDimensions(
      bitmap.width,
      bitmap.height,
      preset.maxDimension,
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    // Step quality down until it fits. Three tries is enough to take a huge
    // photo well under the cap; past that the image is pathological and the
    // caller's check should be the one to say so.
    let blob: Blob | null = null;
    for (const quality of [preset.quality, preset.quality - 0.2, preset.quality - 0.35]) {
      blob = await encode(canvas, Math.max(0.4, quality));
      if (blob && blob.size <= preset.maxBytes) break;
    }

    if (!blob || blob.size >= file.size) return file;

    return new File([blob], toWebpName(file.name), {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}
