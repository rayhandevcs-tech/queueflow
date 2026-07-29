import { z } from "zod";
import { ROLES } from "@/config/constants";

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "নাম কমপক্ষে ২ অক্ষরের হতে হবে").max(80, "সর্বোচ্চ ৮০ অক্ষর"),
    email: z.string().trim().min(1, "ইমেইল লিখো").email("সঠিক ইমেইল লিখো"),
    password: z.string().min(6, "কমপক্ষে ৬ অক্ষর"),
    confirmPassword: z.string().min(6, "কমপক্ষে ৬ অক্ষর"),
    role: z.enum([ROLES.CUSTOMER, ROLES.PROVIDER], {
      message: "অ্যাকাউন্টের ধরন বেছে নাও",
    }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "পাসওয়ার্ড মিলছে না",
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
