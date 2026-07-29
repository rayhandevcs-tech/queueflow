import { z } from "zod";

export const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "কমপক্ষে ৬ অক্ষর"),
    confirmPassword: z.string().min(6, "কমপক্ষে ৬ অক্ষর"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "পাসওয়ার্ড মিলছে না",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
