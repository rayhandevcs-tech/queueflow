import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email").email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
