import { z } from "zod";
import { ROLES } from "@/config/constants";

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Max 80 characters"),
    email: z.string().trim().min(1, "Enter your email").email("Enter a valid email"),
    password: z.string().min(6, "At least 6 characters"),
    confirmPassword: z.string().min(6, "At least 6 characters"),
    role: z.enum([ROLES.CUSTOMER, ROLES.PROVIDER], {
      message: "Choose an account type",
    }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
