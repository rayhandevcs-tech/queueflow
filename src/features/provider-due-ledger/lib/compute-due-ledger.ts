export interface DueSerialRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_avatar_url: string | null;
  due_amount: number;
  completed_at: string | null;
  due_reminded_at: string | null;
}

/**
 * One unpaid parlour appointment.
 *
 * Same shape as `DueSerialRow` — decision 29 again — but kept a separate type
 * and a separate argument for one concrete reason: the ledger's two actions
 * ("collect" and "remind") both work by id, and an appointment id sent to
 * `send_due_reminder(p_serial_id)` would fail. Keeping the two id lists apart
 * is what lets one screen settle debts that live in two tables.
 */
export interface DueAppointmentRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_avatar_url: string | null;
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
  avatarUrl: string | null;
  totalDue: number;
  serialIds: string[];
  /** Unpaid appointments for the same person — settled through their own table. */
  appointmentIds: string[];
  /** Oldest still-unsettled visit — drives "longest overdue first" sorting. */
  oldestDueAt: string | null;
  remindableSerialIds: string[];
  remindableAppointmentIds: string[];
}

const REMIND_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Groups raw DONE+DUE rows by customer so the ledger shows one balance per
 * person — across both tables.
 *
 * A parlour customer who left without paying owes the shop money in exactly
 * the sense a salon customer does, so they belong on the same page. What must
 * not blur is *which table* each debt lives in: the ids stay in separate
 * lists so collecting and reminding hit the right one.
 */
export function computeDueLedger(
  rows: DueSerialRow[],
  now: Date,
  /** Last and optional — a salon passes nothing and gets its old behaviour. */
  appointmentRows: DueAppointmentRow[] = [],
): DueCustomerGroup[] {
  const groups = new Map<string, DueCustomerGroup>();

  /** One debt, from either table. `into` says which id list it joins. */
  function add(
    r: DueSerialRow | DueAppointmentRow,
    into: "serialIds" | "appointmentIds",
    remindInto: "remindableSerialIds" | "remindableAppointmentIds",
  ): void {
    const key = r.customer_id ?? `phone:${r.customer_phone ?? r.id}`;
    const remindable =
      r.customer_id !== null &&
      (!r.due_reminded_at || now.getTime() - new Date(r.due_reminded_at).getTime() > REMIND_COOLDOWN_MS);

    const existing = groups.get(key);
    if (existing) {
      existing.totalDue += r.due_amount;
      existing[into].push(r.id);
      if (remindable) existing[remindInto].push(r.id);
      if (r.completed_at && (!existing.oldestDueAt || r.completed_at < existing.oldestDueAt)) {
        existing.oldestDueAt = r.completed_at;
      }
      return;
    }

    groups.set(key, {
      key,
      customerId: r.customer_id,
      name: r.customer_name,
      phone: r.customer_phone,
      avatarUrl: r.customer_avatar_url,
      totalDue: r.due_amount,
      serialIds: into === "serialIds" ? [r.id] : [],
      appointmentIds: into === "appointmentIds" ? [r.id] : [],
      oldestDueAt: r.completed_at,
      remindableSerialIds: remindable && remindInto === "remindableSerialIds" ? [r.id] : [],
      remindableAppointmentIds:
        remindable && remindInto === "remindableAppointmentIds" ? [r.id] : [],
    });
  }

  for (const r of rows) add(r, "serialIds", "remindableSerialIds");
  for (const r of appointmentRows) add(r, "appointmentIds", "remindableAppointmentIds");

  return [...groups.values()].sort((a, b) => (a.oldestDueAt ?? "").localeCompare(b.oldestDueAt ?? ""));
}
