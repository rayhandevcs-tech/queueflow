import { describe, expect, it } from "vitest";
import { countdownProgress, remainingMin, remainingSec, type RunningJob } from "./queue-wait";

const T0 = Date.parse("2026-08-15T10:00:00.000Z");
const min = (n: number) => n * 60_000;

function job(overrides: Partial<RunningJob> = {}): RunningJob {
  return { started_at: "2026-08-15T10:00:00.000Z", estimated_duration_min: 40, ...overrides };
}

describe("remainingSec", () => {
  it("opens at the service's full time the moment the job starts", () => {
    // The bug this guards: a 40-minute service used to open at whatever the
    // chair had *learned*, which testing drove down to 3 minutes.
    expect(remainingSec(job(), T0)).toBe(40 * 60);
  });

  it("counts down in real time", () => {
    expect(remainingSec(job(), T0 + min(1))).toBe(39 * 60);
    expect(remainingSec(job(), T0 + min(39.5))).toBe(30);
  });

  it("stops at zero instead of going negative when a job overruns", () => {
    expect(remainingSec(job(), T0 + min(55))).toBe(0);
  });

  it("treats a not-yet-written start as starting now, not as finished", () => {
    // One render can arrive before started_at lands; the ring must show the
    // full service time, never a flash of 00:00.
    expect(remainingSec(job({ started_at: null }), T0)).toBe(40 * 60);
  });

  it("honours whatever duration the row carries, short or long", () => {
    for (const d of [1, 5, 40, 90, 240]) {
      expect(remainingSec(job({ estimated_duration_min: d }), T0)).toBe(d * 60);
    }
  });
});

describe("countdownProgress", () => {
  it("runs 1 → 0 across the service time", () => {
    expect(countdownProgress(job(), T0)).toBe(1);
    expect(countdownProgress(job(), T0 + min(20))).toBeCloseTo(0.5);
    expect(countdownProgress(job(), T0 + min(40))).toBe(0);
  });

  it("stays at 0 past the end rather than turning negative", () => {
    expect(countdownProgress(job(), T0 + min(60))).toBe(0);
  });

  it("does not divide by zero on a zero-duration row", () => {
    expect(countdownProgress(job({ estimated_duration_min: 0 }), T0)).toBe(0);
  });
});

describe("remainingMin", () => {
  it("rounds part-minutes up so the backlog never understates the wait", () => {
    expect(remainingMin(job(), T0 + min(0.5))).toBe(40);
    expect(remainingMin(job(), T0 + min(38.2))).toBe(2);
  });

  it("floors at one minute for an overrunning job", () => {
    expect(remainingMin(job(), T0 + min(80))).toBe(1);
  });
});

describe("cancelling mid-service and starting the next one", () => {
  it("gives the replacement job its own full clock", () => {
    // 12 minutes into a 40-minute job the owner cancels and starts the next
    // customer, who booked a 25-minute service. The new ring must read 25:00 —
    // nothing carries over from the abandoned job.
    const cancelledAt = T0 + min(12);
    expect(remainingSec(job(), cancelledAt)).toBe(28 * 60);

    const replacement = job({
      started_at: new Date(cancelledAt).toISOString(),
      estimated_duration_min: 25,
    });
    expect(remainingSec(replacement, cancelledAt)).toBe(25 * 60);
    expect(countdownProgress(replacement, cancelledAt)).toBe(1);
    expect(remainingSec(replacement, cancelledAt + min(5))).toBe(20 * 60);
  });

  it("keeps the owner's manual extension in the clock", () => {
    // +10 is written into estimated_duration_min, so the ring simply grows.
    const extended = job({ estimated_duration_min: 40 + 10 });
    expect(remainingSec(extended, T0 + min(40))).toBe(10 * 60);
  });
});
