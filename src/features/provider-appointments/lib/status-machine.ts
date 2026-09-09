import type { AppointmentStatus } from "./types";

/**
 * Which status can follow which.
 *
 * **This is a mirror, not the rule.** The authority is
 * `appointment_before_update()` in `20260918_appointment_core.sql`; this copy
 * exists so the UI can avoid offering a button the database would refuse, and
 * the two lists have to be changed together.
 *
 * Mirroring rather than asking the server is the same trade the queue makes:
 * a board that greys out impossible actions is usable, and a racing tap still
 * loses to the database, which is where it should lose.
 */
const NEXT: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  // "Pending" in the brief's words — booked by the customer, not yet
  // acknowledged by the shop.
  BOOKED: ["CONFIRMED", "IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  // No NO_SHOW from here: someone whose service has started has evidently
  // shown up.
  IN_PROGRESS: ["DONE", "CANCELLED"],
  DONE: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function nextStatuses(from: AppointmentStatus): readonly AppointmentStatus[] {
  return NEXT[from] ?? [];
}

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return nextStatuses(from).includes(to);
}

/** Nothing more will happen to it — the board stops offering actions. */
export function isTerminal(status: AppointmentStatus): boolean {
  return nextStatuses(status).length === 0;
}

/**
 * The one action the board leads with for a given status, or null when there
 * is nothing obvious to do. Cancelling is always available where legal, but it
 * is never the primary button.
 */
export function primaryAction(from: AppointmentStatus): AppointmentStatus | null {
  switch (from) {
    case "BOOKED":
      return "CONFIRMED";
    case "CONFIRMED":
      return "IN_PROGRESS";
    case "IN_PROGRESS":
      return "DONE";
    default:
      return null;
  }
}
