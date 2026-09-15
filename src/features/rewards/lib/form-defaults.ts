import type { RewardKind } from "@/types";
import { REWARD_KINDS } from "./rewards";

/**
 * The kinds the form offers, in the order it offers them.
 *
 * A separate constant from `REWARD_KINDS` only so the segmented control has a
 * plainly mutable-free array of the right type without the form importing the
 * `as const` tuple and widening it at the call site.
 */
export const DEFAULT_KINDS: readonly RewardKind[] = REWARD_KINDS;
