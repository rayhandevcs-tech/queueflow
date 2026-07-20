import { z } from "zod";
import { LIMITS } from "@/config/constants";

export const walkInSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(1, "Enter the customer's name")
    .max(80, "Max 80 characters"),
  customerPhone: z
    .string()
    .trim()
    .max(LIMITS.MAX_PHONE_LENGTH, "Max 20 digits")
    .regex(/^[0-9+\-\s]*$/, "Digits, +, - only")
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v)),
  serviceIds: z
    .array(z.string().uuid())
    .min(1, "Choose at least one service")
    .max(LIMITS.MAX_SERVICES_PER_SERIAL, "Max 10 services"),
  /** null → auto (DB picks the earliest-finish chair) */
  chairId: z.string().uuid().nullable().default(null),
});

export type WalkInFormValues = z.input<typeof walkInSchema>;
export type WalkInFormOutput = z.output<typeof walkInSchema>;
