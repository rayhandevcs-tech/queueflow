import { z } from "zod";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "বর্তমান পাসওয়ার্ড লিখো"),
    newPassword: z.string().min(6, "কমপক্ষে ৬ অক্ষর"),
    confirmPassword: z.string().min(6, "কমপক্ষে ৬ অক্ষর"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "পাসওয়ার্ড মিলছে না",
    path: ["confirmPassword"],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
