import { describe, expect, it } from "vitest";
import type { Serial } from "@/types";
import { computeHabits } from "./habits";

const NOW = new Date(2026, 7, 15);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

function visit(over: Partial<Serial> = {}): Serial {
  return {
    status: "DONE",
    completed_at: daysAgo(10),
    shop_id: "s1",
    chair_id: "c1",
    ...over,
  } as Serial;
}

describe("computeHabits", () => {
  it("says nothing at all with no completed visits", () => {
    const h = computeHabits([], NOW);
    expect(h).toMatchObject({
      visitCount: 0,
      avgDaysBetween: null,
      daysSinceLast: null,
      overdue: false,
      suggestedIntervalDays: null,
    });
  });

  it("needs two visits before it claims a rhythm", () => {
    const h = computeHabits([visit()], NOW);
    expect(h.visitCount).toBe(1);
    expect(h.avgDaysBetween).toBeNull();
    expect(h.daysSinceLast).toBe(10);
  });

  it("averages the gap across visits", () => {
    // 60, 40, 20 days ago → two 20-day gaps.
    const h = computeHabits(
      [
        visit({ completed_at: daysAgo(60) }),
        visit({ completed_at: daysAgo(40) }),
        visit({ completed_at: daysAgo(20) }),
      ],
      NOW,
    );
    expect(h.avgDaysBetween).toBe(20);
    expect(h.daysSinceLast).toBe(20);
  });

  it("ignores cancellations, which say nothing about how often someone visits", () => {
    // Counting the cancelled row would halve the average and make every
    // reminder arrive early.
    const h = computeHabits(
      [
        visit({ completed_at: daysAgo(40) }),
        visit({ status: "CANCELLED", completed_at: daysAgo(30) }),
        visit({ completed_at: daysAgo(20) }),
      ],
      NOW,
    );
    expect(h.visitCount).toBe(2);
    expect(h.avgDaysBetween).toBe(20);
  });

  it("flags overdue only once past their own usual gap", () => {
    const onTime = computeHabits(
      [visit({ completed_at: daysAgo(35) }), visit({ completed_at: daysAgo(15) })],
      NOW,
    );
    expect(onTime.overdue).toBe(false);

    const late = computeHabits(
      [visit({ completed_at: daysAgo(60) }), visit({ completed_at: daysAgo(40) })],
      NOW,
    );
    expect(late.overdue).toBe(true);
  });

  it("picks the most-visited shop and staff member", () => {
    const h = computeHabits(
      [
        visit({ shop_id: "s1", chair_id: "c1" }),
        visit({ shop_id: "s2", chair_id: "c9" }),
        visit({ shop_id: "s1", chair_id: "c1" }),
      ],
      NOW,
    );
    expect(h.favouriteShopId).toBe("s1");
    expect(h.favouriteChairId).toBe("c1");
  });

  it("survives visits with no staff recorded", () => {
    // chair_id is non-null in the schema, but the column predates this repo's
    // migration history and the guard in computeHabits is cheap — this pins it.
    const noStaff = [
      { ...visit(), chair_id: null },
      { ...visit(), chair_id: null },
    ] as unknown as Serial[];
    expect(computeHabits(noStaff, NOW).favouriteChairId).toBeNull();
  });

  it("suggests a whole number of weeks", () => {
    // 19-day rhythm → three weeks, because nobody thinks "every 19 days".
    const h = computeHabits(
      [visit({ completed_at: daysAgo(38) }), visit({ completed_at: daysAgo(19) })],
      NOW,
    );
    expect(h.avgDaysBetween).toBe(19);
    expect(h.suggestedIntervalDays).toBe(21);
  });

  it("never suggests less than a week or more than half a year", () => {
    const tight = computeHabits(
      [visit({ completed_at: daysAgo(2) }), visit({ completed_at: daysAgo(1) })],
      NOW,
    );
    expect(tight.suggestedIntervalDays).toBe(7);
  });
});
