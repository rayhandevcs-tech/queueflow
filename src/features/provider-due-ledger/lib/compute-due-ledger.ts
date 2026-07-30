export interface DueSerialRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  due_amount: number;
  completed_at: string | null;
  due_reminded_at: string | null;
}

export interface DueCustomerGroup {
  /** customer_id when known, else a phone/serial-derived fallback key. */
  key: string;
  customerId: string | null;
  name: string;
  phone: string | null;
  totalDue: number;
  serialIds: string[];
  /** Oldest still-unsettled visit — drives "longest overdue first" sorting. */
  oldestDueAt: string | null;
  remindableSerialIds: string[];
}

const REMIND_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Groups raw DONE+DUE rows by customer so the ledger shows one balance per person. */
export function computeDueLedger(rows: DueSerialRow[], now: Date): DueCustomerGroup[] {
  const groups = new Map<string, DueCustomerGroup>();

  for (const r of rows) {
    const key = r.customer_id ?? `phone:${r.customer_phone ?? r.id}`;
    const remindable =
      r.customer_id !== null &&
      (!r.due_reminded_at || now.getTime() - new Date(r.due_reminded_at).getTime() > REMIND_COOLDOWN_MS);

    const existing = groups.get(key);
    if (existing) {
      existing.totalDue += r.due_amount;
      existing.serialIds.push(r.id);
      if (remindable) existing.remindableSerialIds.push(r.id);
      if (r.completed_at && (!existing.oldestDueAt || r.completed_at < existing.oldestDueAt)) {
        existing.oldestDueAt = r.completed_at;
      }
    } else {
      groups.set(key, {
        key,
        customerId: r.customer_id,
        name: r.customer_name,
        phone: r.customer_phone,
        totalDue: r.due_amount,
        serialIds: [r.id],
        oldestDueAt: r.completed_at,
        remindableSerialIds: remindable ? [r.id] : [],
      });
    }
  }

  return [...groups.values()].sort((a, b) => (a.oldestDueAt ?? "").localeCompare(b.oldestDueAt ?? ""));
}
