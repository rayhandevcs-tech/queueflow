import { describe, expect, it } from "vitest";
import type { Serial } from "@/types";
import { partyInfo, partyOutstanding } from "./party";

function serial(over: Partial<Serial> & { id: string }): Serial {
  return {
    status: "WAITING",
    group_id: null,
    party_seq: null,
    total_amount: 100,
    due_amount: 0,
    payment_status: "DUE",
    ...over,
  } as Serial;
}

describe("partyInfo", () => {
  it("returns nothing for a solo booking", () => {
    const solo = serial({ id: "a" });
    expect(partyInfo(solo, [solo])).toBeNull();
  });

  it("numbers a member against the party's board order", () => {
    const rows = [
      serial({ id: "a", group_id: "g", party_seq: 1 }),
      serial({ id: "b", group_id: "g", party_seq: 2 }),
      serial({ id: "c", group_id: "g", party_seq: 3 }),
    ];
    expect(partyInfo(rows[1], rows)).toEqual({ size: 3, index: 2 });
  });

  it("counts who is still on the board, not the party's original size", () => {
    // The middle member was cancelled; "2 of 2" is what's left to serve.
    const rows = [
      serial({ id: "a", group_id: "g", party_seq: 1 }),
      serial({ id: "c", group_id: "g", party_seq: 3 }),
    ];
    expect(partyInfo(rows[1], rows)).toEqual({ size: 2, index: 2 });
  });

  it("drops the badge once a member is the last one left", () => {
    // Nothing is still coming, so there is nothing for the badge to warn about.
    const last = serial({ id: "c", group_id: "g", party_seq: 3 });
    expect(partyInfo(last, [last])).toBeNull();
  });

  it("ignores members of a different party on the same board", () => {
    const rows = [
      serial({ id: "a", group_id: "g1", party_seq: 1 }),
      serial({ id: "b", group_id: "g1", party_seq: 2 }),
      serial({ id: "x", group_id: "g2", party_seq: 1 }),
      serial({ id: "y", group_id: "g2", party_seq: 2 }),
    ];
    expect(partyInfo(rows[0], rows)).toEqual({ size: 2, index: 1 });
  });
});

describe("partyOutstanding", () => {
  it("counts only served members who still owe", () => {
    const rows = [
      serial({ id: "a", status: "DONE", payment_status: "DUE", due_amount: 150 }),
      serial({ id: "b", status: "DONE", payment_status: "PAID", due_amount: 0 }),
      serial({ id: "c", status: "WAITING", payment_status: "DUE", due_amount: 0 }),
      serial({ id: "self", status: "IN_PROGRESS" }),
    ];
    expect(partyOutstanding("self", rows)).toEqual({ count: 1, amount: 150 });
  });

  it("never bills the serial being paid for twice", () => {
    const rows = [serial({ id: "self", status: "DONE", payment_status: "DUE", due_amount: 200 })];
    expect(partyOutstanding("self", rows)).toEqual({ count: 0, amount: 0 });
  });

  it("falls back to the full amount when due_amount was never set", () => {
    // A row marked DUE without an explicit balance owes the whole bill.
    const rows = [
      serial({ id: "a", status: "DONE", payment_status: "DUE", due_amount: 0, total_amount: 320 }),
    ];
    expect(partyOutstanding("self", rows)).toEqual({ count: 1, amount: 320 });
  });

  it("is empty for a solo booking with no party rows", () => {
    expect(partyOutstanding("self", [])).toEqual({ count: 0, amount: 0 });
  });
});
