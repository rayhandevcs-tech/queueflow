import { z } from "zod";

/**
 * The shape the analysis comes back in.
 *
 * Structured rather than prose for two reasons. The UI can colour a finding by
 * its own tone instead of guessing from the wording; and every action is
 * required to carry the figure it follows from — an instruction with no stated
 * "why" is one a shopkeeper either ignores or, worse, follows blindly.
 *
 * It lives in the feature rather than beside the route because both the route
 * and the hook need it, and a feature may not import from `app`.
 */
export const InsightsSchema = z.object({
  headline: z
    .string()
    .describe("One sentence in Bangla — the single most important thing this month."),
  findings: z
    .array(
      z.object({
        title: z.string().describe("Four to eight words in Bangla."),
        detail: z
          .string()
          .describe("Two or three sentences in Bangla, citing the figures involved."),
        tone: z.enum(["good", "warning", "neutral"]),
      }),
    )
    .describe("Three to five findings, most important first."),
  actions: z
    .array(
      z.object({
        action: z.string().describe("One concrete thing to do this week, in Bangla."),
        why: z.string().describe("The figure from the brief that makes this worth doing."),
      }),
    )
    .describe("Two or three actions. Fewer is better than vague ones."),
  dataNote: z
    .string()
    .nullable()
    .describe(
      "Bangla, or null. Set only when the data is too thin to trust, or something in it looks like an entry mistake.",
    ),
});

export type ShopInsights = z.infer<typeof InsightsSchema>;
