import { z } from "zod";

/**
 * What the advisor comes back with.
 *
 * `slug` rather than a free-text name, because the answer has to join back to
 * a real row in the catalogue — a model that invents "Modern Layered Fade" is
 * giving advice the customer cannot act on and the shop cannot deliver. The
 * route drops any slug it does not recognise.
 *
 * `faceRead` is deliberately separate from the recommendations. Seeing the
 * reasoning stated once ("গোলাকার মুখ, চাপা চোয়াল") lets the customer judge
 * whether the advice is built on a correct reading of their face, instead of
 * having to take five recommendations on trust.
 */
export const StyleAdviceSchema = z.object({
  faceRead: z
    .string()
    .describe(
      "One or two sentences in Bangla describing what you see: face shape, jawline, hairline, hair texture. Only what is visible.",
    ),
  recommendations: z
    .array(
      z.object({
        slug: z.string().describe("The exact slug of a style from the catalogue given to you."),
        reason: z
          .string()
          .describe("One or two sentences in Bangla: why this suits THIS face specifically."),
        confidence: z.enum(["high", "medium"]),
      }),
    )
    .describe("Three to five styles, best fit first."),
  avoid: z
    .object({
      slug: z.string(),
      reason: z.string().describe("One sentence in Bangla, kind in tone."),
    })
    .nullable()
    .describe("One style worth steering away from, or null if nothing stands out."),
  caveat: z
    .string()
    .nullable()
    .describe(
      "Bangla, or null. Set when the photo makes this hard — bad light, face turned away, hair covered, more than one person.",
    ),
});

export type StyleAdvice = z.infer<typeof StyleAdviceSchema>;
