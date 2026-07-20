import { z } from "zod";

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Max 60 characters"),
  rate: z.coerce.number().min(0, "Rate must be 0 or more").max(99999, "Rate is too large"),
  default_duration_min: z.coerce
    .number()
    .int("Enter a whole number")
    .min(1, "At least 1 minute")
    .max(480, "Max 480 minutes"),
});

export type ServiceFormValues = z.input<typeof serviceSchema>;
export type ServiceFormOutput = z.output<typeof serviceSchema>;
