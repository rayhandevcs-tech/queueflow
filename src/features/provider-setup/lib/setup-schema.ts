import { z } from "zod";

/**
 * A draft shop profile, for the owner to edit before anything is saved.
 *
 * Everything here is a suggestion. The owner reviews the whole thing, changes
 * what is wrong, and only then does it become rows — a setup assistant that
 * writes straight to the database would fill a real shop's catalogue with
 * services it does not offer at prices it does not charge, and the owner would
 * spend longer deleting than they would have spent typing.
 */
export const ShopSetupSchema = z.object({
  /** Bangla, two or three sentences, written as the shop would describe itself. */
  about: z.string(),

  services: z
    .array(
      z.object({
        nameBn: z.string(),
        nameEn: z.string(),
        rate: z.number(),
        durationMin: z.number(),
        /** Bangla: why this price — cite the neighbour figures where they exist. */
        priceNote: z.string(),
      }),
    )
    .describe("Five to ten services, the common ones first."),

  /** Bangla, or null. Set when the photos were too unclear to read much from. */
  photoNote: z.string().nullable(),
});

export type ShopSetupDraft = z.infer<typeof ShopSetupSchema>;
