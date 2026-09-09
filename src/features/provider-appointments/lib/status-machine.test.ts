import { describe, expect, it } from "vitest";
import { OCCUPYING_STATUSES, type AppointmentStatus } from "./types";
import {
  canTransition,
  isTerminal,
  nextStatuses,
  primaryAction,
} from "./status-machine";

const ALL: AppointmentStatus[] = [
  "BOOKED",
  "CONFIRMED",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
  "NO_SHOW",
];

/**
 * The transitions `appointment_before_update()` permits, written out
 * independently of the implementation. If this table and the migration ever
 * disagree, one of them is a bug — and the migration wins.
 */
const ALLOWED: ReadonlyArray<[AppointmentStatus, AppointmentStatus]> = [
  ["BOOKED", "CONFIRMED"],
  ["BOOKED", "IN_PROGRESS"],
  ["BOOKED", "CANCELLED"],
  ["BOOKED", "NO_SHOW"],
  ["CONFIRMED", "IN_PROGRESS"],
  ["CONFIRMED", "CANCELLED"],
  ["CONFIRMED", "NO_SHOW"],
  ["IN_PROGRESS", "DONE"],
  ["IN_PROGRESS", "CANCELLED"],
];

describe("canTransition", () => {
  it("allows exactly the moves the database allows, and nothing else", () => {
    for (const from of ALL) {
      for (const to of ALL) {
        const expected = ALLOWED.some(([f, t]) => f === from && t === to);
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected);
      }
    }
  });

  it("never lets a status transition to itself", () => {
    for (const status of ALL) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  // Backwards moves are the ones a mis-tap would produce, and the ones that
  // would quietly rewrite a finished day.
  it("never goes backwards", () => {
    expect(canTransition("CONFIRMED", "BOOKED")).toBe(false);
    expect(canTransition("IN_PROGRESS", "CONFIRMED")).toBe(false);
    expect(canTransition("DONE", "IN_PROGRESS")).toBe(false);
  });

  it("cannot resurrect a finished, cancelled or no-show appointment", () => {
    for (const terminal of ["DONE", "CANCELLED", "NO_SHOW"] as const) {
      for (const to of ALL) {
        expect(canTransition(terminal, to), `${terminal} -> ${to}`).toBe(false);
      }
    }
  });

  // Someone whose service has started has evidently turned up.
  it("has no no-show once the work has started", () => {
    expect(canTransition("IN_PROGRESS", "NO_SHOW")).toBe(false);
  });

  it("lets a booking be cancelled from every live state", () => {
    for (const live of ["BOOKED", "CONFIRMED", "IN_PROGRESS"] as const) {
      expect(canTransition(live, "CANCELLED")).toBe(true);
    }
  });
});

describe("isTerminal", () => {
  it("is true for exactly the three end states", () => {
    expect(isTerminal("DONE")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("NO_SHOW")).toBe(true);
    expect(isTerminal("BOOKED")).toBe(false);
    expect(isTerminal("CONFIRMED")).toBe(false);
    expect(isTerminal("IN_PROGRESS")).toBe(false);
  });

  it("agrees with nextStatuses being empty", () => {
    for (const status of ALL) {
      expect(isTerminal(status)).toBe(nextStatuses(status).length === 0);
    }
  });
});

describe("primaryAction", () => {
  it("walks the happy path one step at a time", () => {
    expect(primaryAction("BOOKED")).toBe("CONFIRMED");
    expect(primaryAction("CONFIRMED")).toBe("IN_PROGRESS");
    expect(primaryAction("IN_PROGRESS")).toBe("DONE");
  });

  it("offers nothing on a finished appointment", () => {
    expect(primaryAction("DONE")).toBeNull();
    expect(primaryAction("CANCELLED")).toBeNull();
    expect(primaryAction("NO_SHOW")).toBeNull();
  });

  it("only ever suggests a move the machine permits", () => {
    for (const status of ALL) {
      const next = primaryAction(status);
      if (next) expect(canTransition(status, next)).toBe(true);
    }
  });
});

describe("OCCUPYING_STATUSES", () => {
  // These three are the WHERE clause of appointments_no_overlap. If the app's
  // idea of "this slot is taken" ever drifts from the constraint's, the board
  // would draw free time the database refuses to sell.
  it("matches the exclusion constraint's live set", () => {
    expect([...OCCUPYING_STATUSES].sort()).toEqual(
      ["BOOKED", "CONFIRMED", "IN_PROGRESS"].sort(),
    );
  });

  it("holds exactly the non-terminal statuses", () => {
    expect([...OCCUPYING_STATUSES].sort()).toEqual(ALL.filter((s) => !isTerminal(s)).sort());
  });
});
