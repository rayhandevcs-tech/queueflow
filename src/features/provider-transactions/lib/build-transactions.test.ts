import { describe, expect, it } from "vitest";
import {
  buildTransactions,
  groupByDay,
  totalsOf,
  type ExpenseTxRow,
  type AppointmentTxRow,
  type ManualTxRow,
  type SerialTxRow,
} from "./build-transactions";

const opts = {
  walkInLabel: "walk-in",
  manualLabel: "manual",
  expenseLabel: (c: string) => `cat:${c}`,
} as Parameters<typeof buildTransactions>[3];

function serial(o: Partial<SerialTxRow> = {}): SerialTxRow {
  return {
    id: "s1",
    completed_at: "2026-08-15T10:00:00.000Z",
    total_amount: 100,
    payment_status: "PAID",
    payment_method: "cash",
    customer_name: "Salam",
    customer_avatar_url: "https://example.test/a.png",
    party_member_name: null,
    is_walk_in: false,
    services_snapshot: [{ name: "Hair Cutting", rate: 100 }],
    ...o,
  };
}

function manual(o: Partial<ManualTxRow> = {}): ManualTxRow {
  return {
    id: "m1",
    amount: 50,
    created_at: "2026-08-15T11:00:00.000Z",
    payment_status: "PAID",
    payment_method: "cash",
    customer_name: null,
    note: null,
    ...o,
  };
}

function expense(o: Partial<ExpenseTxRow> = {}): ExpenseTxRow {
  return { id: "e1", amount: 3000, spent_on: "2026-08-15", category: "RENT", note: null, ...o };
}

function appointment(o: Partial<AppointmentTxRow> = {}): AppointmentTxRow {
  return {
    id: "a1",
    completed_at: "2026-08-15T12:00:00.000Z",
    total_amount: 500,
    payment_status: "PAID",
    payment_method: "bkash",
    customer_name: "Nusrat",
    customer_avatar_url: null,
    is_walk_in: false,
    services_snapshot: [{ name: "Facial", rate: 500 }],
    ...o,
  };
}

describe("buildTransactions", () => {
  it("puts money in as positive and money out as negative", () => {
    const rows = buildTransactions([serial()], [], [expense()], opts);
    expect(rows.find((r) => r.kind === "SERIAL")!.amount).toBe(100);
    expect(rows.find((r) => r.kind === "EXPENSE")!.amount).toBe(-3000);
  });

  it("sorts every source together, newest first", () => {
    const rows = buildTransactions(
      [serial({ id: "old", completed_at: "2026-08-14T10:00:00.000Z" })],
      [manual({ id: "mid", created_at: "2026-08-15T09:00:00.000Z" })],
      [expense({ id: "new", spent_on: "2026-08-16" })],
      opts,
    );
    expect(rows.map((r) => r.id)).toEqual(["new", "mid", "old"]);
  });

  it("carries the customer's name and photo onto the row", () => {
    const [row] = buildTransactions([serial()], [], [], opts);
    expect(row.title).toBe("Salam");
    expect(row.avatarUrl).toBe("https://example.test/a.png");
    expect(row.subtitle).toBe("Hair Cutting");
  });

  it("prefers a party member's own name over the account holder's", () => {
    const [row] = buildTransactions([serial({ party_member_name: "Karim" })], [], [], opts);
    expect(row.title).toBe("Karim");
  });

  it("falls back to a label when no name was taken", () => {
    const [row] = buildTransactions([serial({ customer_name: null })], [], [], opts);
    expect(row.title).toBe("walk-in");
  });

  it("skips a serial that never completed — no money moved", () => {
    expect(buildTransactions([serial({ completed_at: null })], [], [], opts)).toHaveLength(0);
  });

  it("marks an uncollected job unpaid without changing its sign", () => {
    const [row] = buildTransactions(
      [serial({ payment_status: "DUE", payment_method: null })],
      [],
      [],
      opts,
    );
    expect(row.unpaid).toBe(true);
    expect(row.amount).toBe(100);
  });

  it("uses the expense note as the title, keeping the category as the subtitle", () => {
    const [row] = buildTransactions([], [], [expense({ note: "আগস্টের ভাড়া" })], opts);
    expect(row.title).toBe("আগস্টের ভাড়া");
    expect(row.subtitle).toBe("cat:RENT");
  });

  it("titles a note-less expense by its category", () => {
    const [row] = buildTransactions([], [], [expense({ note: "  " })], opts);
    expect(row.title).toBe("cat:RENT");
    expect(row.subtitle).toBeNull();
  });

  it("dates an expense to the day it was spent on, not a timezone earlier", () => {
    const [row] = buildTransactions([], [], [expense({ spent_on: "2026-08-15" })], opts);
    expect(new Date(row.atMs).getDate()).toBe(15);
  });
});

describe("totalsOf", () => {
  it("separates collected, spent and still-owed", () => {
    const rows = buildTransactions(
      [
        serial({ id: "a", total_amount: 100 }),
        serial({ id: "b", total_amount: 70, payment_status: "DUE" }),
      ],
      [manual({ amount: 30 })],
      [expense({ amount: 3000 })],
      opts,
    );

    expect(totalsOf(rows)).toEqual({
      inflow: 130, // 100 + 30, the due 70 excluded
      outflow: 3000,
      pending: 70,
      net: 130 - 3000,
    });
  });

  it("is all zeros for an empty ledger", () => {
    expect(totalsOf([])).toEqual({ inflow: 0, outflow: 0, pending: 0, net: 0 });
  });
});

describe("groupByDay", () => {
  it("buckets consecutive rows from the same day together", () => {
    const rows = buildTransactions(
      [
        serial({ id: "a", completed_at: "2026-08-15T10:00:00.000Z" }),
        serial({ id: "b", completed_at: "2026-08-15T18:00:00.000Z" }),
        serial({ id: "c", completed_at: "2026-08-14T10:00:00.000Z" }),
      ],
      [],
      [],
      opts,
    );
    const days = groupByDay(rows);
    expect(days).toHaveLength(2);
    expect(days[0].rows.map((r) => r.id)).toEqual(["b", "a"]);
    expect(days[1].rows.map((r) => r.id)).toEqual(["c"]);
  });
});

describe("buildTransactions with appointments", () => {
  it("adds nothing when no appointments are passed", () => {
    expect(buildTransactions([serial()], [manual()], [expense()], opts)).toEqual(
      buildTransactions([serial()], [manual()], [expense()], opts, []),
    );
  });

  it("puts a completed appointment on the timeline as its own kind", () => {
    const rows = buildTransactions([], [], [], opts, [appointment()]);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("APPOINTMENT");
    expect(rows[0].amount).toBe(500);
    expect(rows[0].title).toBe("Nusrat");
    expect(rows[0].subtitle).toBe("Facial");
    expect(rows[0].method).toBe("bkash");
    expect(rows[0].unpaid).toBe(false);
  });

  it("skips an appointment that never finished", () => {
    expect(buildTransactions([], [], [], opts, [appointment({ completed_at: null })])).toEqual([]);
  });

  it("marks an unpaid appointment as pending rather than collected", () => {
    const rows = buildTransactions([], [], [], opts, [
      appointment({ payment_status: "DUE", payment_method: null, total_amount: 700 }),
    ]);
    expect(rows[0].unpaid).toBe(true);
    expect(totalsOf(rows)).toEqual({ inflow: 0, outflow: 0, pending: 700, net: 0 });
  });

  it("falls back to the walk-in label when no name was taken", () => {
    const rows = buildTransactions([], [], [], opts, [appointment({ customer_name: null })]);
    expect(rows[0].title).toBe("walk-in");
  });

  it("interleaves appointments with serials and expenses in one newest-first timeline", () => {
    const rows = buildTransactions(
      [serial({ id: "s", completed_at: "2026-08-15T10:00:00.000Z" })],
      [],
      [expense({ id: "e", spent_on: "2026-08-14" })],
      opts,
      [appointment({ id: "a", completed_at: "2026-08-15T14:00:00.000Z" })],
    );
    expect(rows.map((r) => r.id)).toEqual(["a", "s", "e"]);
  });

  it("counts appointment money into the same totals as the rest of the ledger", () => {
    const rows = buildTransactions(
      [serial({ total_amount: 100 })],
      [manual({ amount: 30 })],
      [expense({ amount: 3000 })],
      opts,
      [appointment({ total_amount: 500 })],
    );
    expect(totalsOf(rows)).toEqual({
      inflow: 630,
      outflow: 3000,
      pending: 0,
      net: 630 - 3000,
    });
  });

  it("groups an appointment into the same day bucket as that day's serials", () => {
    const rows = buildTransactions(
      [serial({ id: "s", completed_at: "2026-08-15T10:00:00.000Z" })],
      [],
      [],
      opts,
      [appointment({ id: "a", completed_at: "2026-08-15T18:00:00.000Z" })],
    );
    const days = groupByDay(rows);
    expect(days).toHaveLength(1);
    expect(days[0].rows.map((r) => r.id)).toEqual(["a", "s"]);
  });
});
