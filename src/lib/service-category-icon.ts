import {
  Scissors,
  Droplet,
  Droplets,
  Palette,
  Smile,
  Waves,
  Eye,
  Hand,
  Brush,
  Sparkles,
  Gem,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import type { ServiceCategory } from "@/config/constants";

/**
 * A glyph for every category, used wherever a service has no photo.
 *
 * Exhaustive by type: adding a category to `SERVICE_CATEGORIES` without a
 * glyph is a compile error here. That is also the reason categories are a
 * code list and not a database table — a row inserted in Postgres could never
 * bring its icon with it (decision 40).
 */
export const SERVICE_CATEGORY_ICON: Record<ServiceCategory, LucideIcon> = {
  HAIRCUT: Scissors,
  SHAVE: Droplet,
  COLOR: Palette,
  FACIAL: Smile,
  SPA: Waves,
  THREADING: Eye,
  WAXING: Droplets,
  MEHENDI: Hand,
  MAKEUP: Brush,
  NAILS: Sparkles,
  BRIDAL: Gem,
  OTHER: MoreHorizontal,
};
