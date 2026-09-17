/**
 * The customer card's proposal client — now a re-export.
 *
 * The three functions and the two result types moved to
 * `@/lib/ai/proposal-client` in AI Sprint 5, because the OWNER's campaign
 * approval card needs exactly the same three and `eslint-plugin-boundaries`
 * allows `feature → same-feature` only: `provider-ai` may not import from
 * `customer-ai`.
 *
 * Copying them would have meant two implementations of "confirm a proposal",
 * and the day they drifted one card would post a shape the endpoint no longer
 * expected — a failure that shows up as a button that quietly does nothing.
 *
 * This file stays because every import in this feature (and its tests) points
 * at it, and because the indirection is free. Nothing here has behaviour; the
 * comments explaining the design live with the code, in
 * `@/lib/ai/proposal-client`.
 */

export {
  getProposal,
  confirmProposal,
  cancelProposal,
  type ConfirmSuccess,
  type ConfirmFailure,
} from "@/lib/ai/proposal-client";
