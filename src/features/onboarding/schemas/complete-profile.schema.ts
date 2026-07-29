import { z } from "zod";

export const completeProfileSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(20, "সর্বোচ্চ ২০ ডিজিট")
    .regex(/^[0-9+\-\s]*$/, "শুধু সংখ্যা, +, - ব্যবহার করা যাবে")
    .or(z.literal(""))
    .nullable()
    .transform((v) => (v === "" || v === null ? null : v)),
  gender: z
    .enum(["male", "female", "other"])
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  avatarUrl: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});

export type CompleteProfileFormValues = z.input<typeof completeProfileSchema>;
export type CompleteProfileFormOutput = z.output<typeof completeProfileSchema>;
