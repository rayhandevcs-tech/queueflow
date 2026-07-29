import { z } from "zod";
import { SELECTABLE_BUSINESS_TYPES } from "@/config/constants";

export const shopSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "নাম কমপক্ষে ২ অক্ষরের হতে হবে")
    .max(80, "সর্বোচ্চ ৮০ অক্ষর"),
  address: z.string().trim().max(300, "সর্বোচ্চ ৩০০ অক্ষর").default(""),
  phone: z
    .string()
    .trim()
    .max(20, "সর্বোচ্চ ২০ সংখ্যা")
    .regex(/^[0-9+\-\s]*$/, "শুধু সংখ্যা, +, - অনুমোদিত")
    .or(z.literal(""))
    .nullable()
    .transform((v) => (v === "" || v === null ? null : v)),
  // Validator enforces product policy: SALON | PARLOUR only.
  business_type: z.enum(SELECTABLE_BUSINESS_TYPES),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
});

export type ShopFormValues = z.input<typeof shopSchema>;
export type ShopFormOutput = z.output<typeof shopSchema>;
