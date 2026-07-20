import { z } from "zod";

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Max 80 characters"),
  phone: z
    .string()
    .trim()
    .max(20, "Max 20 digits")
    .regex(/^[0-9+\-\s]*$/, "Digits, +, - only")
    .or(z.literal(""))
    .nullable()
    .transform((v) => (v === "" || v === null ? null : v)),
});

export type ProfileFormValues = z.input<typeof profileSchema>;
export type ProfileFormOutput = z.output<typeof profileSchema>;
