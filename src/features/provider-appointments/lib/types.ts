/**
 * The shape the appointment board draws.
 *
 * This is the seam between Sprint 2 (the screen) and Sprint 4 (the engine).
 * The `appointments` table does not exist yet; when it lands, the only thing
 * that changes is the body of `useTodayAppointments` — every component below
 * it already reads this shape, so the board is a body swap away from live.
 *
 * Deliberately a *view* model rather than the future DB row: the board needs
 * a staff id, a name, a window and a status, and nothing else. Money columns,
 * `services_snapshot`, `reschedule_of` and the rest of the planned row
 * (§৩ Sprint 4) stay out of here until a screen actually reads them.
 */

/** Mirrors the planned `appointment_status` Postgres enum (§৩ Sprint 4). */
export type AppointmentStatus =
  | "BOOKED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "DONE"
  | "CANCELLED"
  | "NO_SHOW";

/** Statuses that still occupy their slot. The rest are drawn as vacated. */
export const OCCUPYING_STATUSES: readonly AppointmentStatus[] = [
  "BOOKED",
  "CONFIRMED",
  "IN_PROGRESS",
];

export interface AppointmentCard {
  id: string;
  /** `chairs.id` — a parlour's "seat" row is also its beautician (Sprint 1). */
  staffId: string;
  customerName: string;
  customerAvatarUrl: string | null;
  /** Already resolved to names; the board never joins services itself. */
  serviceNames: string[];
  /** ISO timestamps. */
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
}
