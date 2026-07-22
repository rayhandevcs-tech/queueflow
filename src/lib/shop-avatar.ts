import { CHAIR_COLORS } from "@/config/constants";

/** Deterministic tile color + initial for a shop without a photo, Palaa-style. */
export function shopAvatarColor(shopId: string): string {
  let hash = 0;
  for (let i = 0; i < shopId.length; i++) {
    hash = (hash * 31 + shopId.charCodeAt(i)) | 0;
  }
  return CHAIR_COLORS[Math.abs(hash) % CHAIR_COLORS.length];
}

export function shopInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
