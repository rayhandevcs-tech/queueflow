import type { Serial } from "@/types";

export interface PartyInfo {
  /** How many of this party are still on the board. */
  size: number;
  /** This member's 1-based place within the party. */
  index: number;
}

/**
 * Where a serial sits in its party, counted against the rows currently on the
 * board rather than the party's original size.
 *
 * That's the number the owner needs: "2 of 3" should mean two are still to be
 * served, not that one was cancelled an hour ago. It also means a party whose
 * others have all finished stops showing a badge, which is correct — there is
 * nothing left to wait for.
 */
export function partyInfo(serial: Serial, boardRows: Serial[]): PartyInfo | null {
  if (!serial.group_id) return null;

  const members = boardRows
    .filter((r) => r.group_id === serial.group_id)
    .sort((a, b) => (a.party_seq ?? 0) - (b.party_seq ?? 0));

  if (members.length < 2) return null;

  const index = members.findIndex((r) => r.id === serial.id);
  return { size: members.length, index: index >= 0 ? index + 1 : 1 };
}

/**
 * What the rest of the party still owes.
 *
 * Note the rows this needs are NOT the board rows: a member who has already
 * been served has left the board, and those are exactly the ones with an
 * outstanding balance. Callers pass the party's own fetched rows
 * (getPartyDues), not the live queue.
 */
export function partyOutstanding(
  serialId: string,
  partyRows: Serial[],
): { count: number; amount: number } {
  const others = partyRows.filter(
    (r) => r.id !== serialId && r.status === "DONE" && r.payment_status === "DUE",
  );

  return {
    count: others.length,
    amount: others.reduce((sum, r) => sum + (r.due_amount || r.total_amount), 0),
  };
}
