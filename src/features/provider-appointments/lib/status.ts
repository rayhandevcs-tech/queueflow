import type { BADGE_VARIANTS } from "@/components/ui/Badge";
import type { AppointmentStatus } from "./types";

/**
 * How each appointment status is drawn.
 *
 * Reuses the app's existing badge tones rather than inventing appointment
 * colours, so a parlour's board reads in the same palette as the queue: live
 * orange is "happening now" here exactly as it is there, good green is
 * "finished", brass is "needs your attention".
 */
/**
 * `onAccent` is excluded: it is the variant for a badge sitting *on* an accent
 * surface, not a status colour, and no status below uses it. Narrowing it away
 * here is what lets a status tone be handed straight to `StatusPill`, which
 * accepts the five real tones.
 */
export type Tone = Exclude<keyof typeof BADGE_VARIANTS, "onAccent">;

export interface StatusStyle {
  tone: Tone;
  /** The slot is free again — drawn faded, so the eye skips it. */
  vacated: boolean;
  /** Only the one thing actually happening pulses; more would be noise. */
  pulse: boolean;
}

const STYLES: Record<AppointmentStatus, StatusStyle> = {
  BOOKED: { tone: "neutral", vacated: false, pulse: false },
  CONFIRMED: { tone: "accent", vacated: false, pulse: false },
  IN_PROGRESS: { tone: "live", vacated: false, pulse: true },
  DONE: { tone: "good", vacated: false, pulse: false },
  CANCELLED: { tone: "neutral", vacated: true, pulse: false },
  NO_SHOW: { tone: "brass", vacated: true, pulse: false },
};

/**
 * Status → its i18n key, spelled out rather than built with a template
 * string, so a missing label is a type error instead of "undefined" on the
 * board.
 */
export const STATUS_LABEL_KEY = {
  BOOKED: "statusBOOKED",
  CONFIRMED: "statusCONFIRMED",
  IN_PROGRESS: "statusIN_PROGRESS",
  DONE: "statusDONE",
  CANCELLED: "statusCANCELLED",
  NO_SHOW: "statusNO_SHOW",
} as const satisfies Record<AppointmentStatus, string>;

export function statusStyle(status: AppointmentStatus): StatusStyle {
  // A status the deploy predates reads as a plain booking rather than
  // throwing — the same tolerance `bookingModel()` has for a new enum value.
  return STYLES[status] ?? STYLES.BOOKED;
}
