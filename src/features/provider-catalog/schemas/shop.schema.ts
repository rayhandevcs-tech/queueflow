import { z } from "zod";
import { SELECTABLE_BUSINESS_TYPES } from "@/config/constants";

export const shopSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Max 80 characters"),
  address: z.string().trim().max(300, "Max 300 characters").default(""),
  phone: z
    .string()
    .trim()
    .max(20, "Max 20 digits")
    .regex(/^[0-9+\-\s]*$/, "Digits, +, - only")
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
