import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "ইমেইল লিখো").email("সঠিক ইমেইল লিখো"),
  password: z.string().min(6, "কমপক্ষে ৬ অক্ষর"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
