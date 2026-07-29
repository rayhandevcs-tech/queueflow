import { Scissors, Droplet, Palette, Smile, Waves, Gem, MoreHorizontal, type LucideIcon } from "lucide-react";
import type { ServiceCategory } from "@/config/constants";

export const SERVICE_CATEGORY_ICON: Record<ServiceCategory, LucideIcon> = {
  HAIRCUT: Scissors,
  SHAVE: Droplet,
  COLOR: Palette,
  FACIAL: Smile,
  SPA: Waves,
  BRIDAL: Gem,
  OTHER: MoreHorizontal,
};
