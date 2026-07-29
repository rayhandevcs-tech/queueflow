import { z } from "zod";

export const offerSchema = z.object({
  title: z.string().trim().min(2, "কমপক্ষে ২ অক্ষর লিখো").max(60, "সর্বোচ্চ ৬০ অক্ষর"),
  description: z.string().trim().max(200, "সর্বোচ্চ ২০০ অক্ষর").optional(),
  discount_pct: z.coerce.number().int("পূর্ণসংখ্যা দাও").min(1, "কমপক্ষে ১%").max(90, "সর্বোচ্চ ৯০%"),
  valid_until: z.string().min(1, "মেয়াদ শেষের তারিখ দাও"),
});

export type OfferFormValues = z.input<typeof offerSchema>;
export type OfferFormOutput = z.output<typeof offerSchema>;
