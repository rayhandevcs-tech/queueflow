import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "ইমেইল লিখো").email("সঠিক ইমেইল লিখো"),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
