import { z } from "zod";

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "নাম কমপক্ষে ২ অক্ষরের হতে হবে")
    .max(80, "সর্বোচ্চ ৮০ অক্ষর"),
  phone: z
    .string()
    .trim()
    .max(20, "সর্বোচ্চ ২০ ডিজিট")
    .regex(/^[0-9+\-\s]*$/, "শুধু সংখ্যা, +, - ব্যবহার করা যাবে")
    .or(z.literal(""))
    .nullable()
    .transform((v) => (v === "" || v === null ? null : v)),
});

export type ProfileFormValues = z.input<typeof profileSchema>;
export type ProfileFormOutput = z.output<typeof profileSchema>;
