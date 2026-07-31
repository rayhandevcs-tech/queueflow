import { z } from "zod";
import type { Language } from "@/lib/i18n";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for the schema-factory convention (decision 4), no language-dependent messages left here
export function completeProfileSchema(lang: Language) {
  return z.object({
    gender: z
      .enum(["male", "female", "other"])
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    avatarUrl: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v ?? null),
  });
}

export type CompleteProfileFormValues = z.input<ReturnType<typeof completeProfileSchema>>;
export type CompleteProfileFormOutput = z.output<ReturnType<typeof completeProfileSchema>>;
