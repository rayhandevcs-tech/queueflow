import { z } from "zod";

export const chairSchema = z.object({
  label: z.string().trim().min(1, "Enter a label").max(40, "Max 40 characters"),
  staff_name: z.string().trim().max(80, "Max 80 characters").default(""),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Not a valid color")
    .nullable()
    .default(null),
});

export type ChairFormValues = z.input<typeof chairSchema>;
export type ChairFormOutput = z.output<typeof chairSchema>;
