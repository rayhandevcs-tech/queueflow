/**
 * Moved to `@/lib/analytics-range`; this re-export keeps the old path working.
 *
 * The move was forced by a boundary rule, and the rule is right. AI Sprint 1
 * needed the analytics date policy — the 1095-day ceiling, the Dhaka day
 * convention, `rangeProblem()` — inside `src/lib/ai/tools`, and eslint's
 * `boundaries/element-types` says shared code may import shared code only. So
 * the choice was: duplicate the range limits in the AI layer, or promote the
 * module that defines them.
 *
 * Duplicating them would have been the worse answer by a distance. There would
 * then be two places that decide how wide a range may be and what a day means,
 * and the moment they disagreed the assistant would quote a number the owner's
 * own dashboard refused to show.
 *
 * The module is pure and imports nothing but `@/lib/day-key`, so promoting it
 * was a file move rather than a refactor. This shim exists so the seven
 * importers inside this feature — and this folder's own test file — did not
 * have to change in the same commit as the AI work.
 */
export * from "@/lib/analytics-range";
