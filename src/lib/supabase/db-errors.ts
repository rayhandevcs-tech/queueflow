export interface FriendlyDbError {
  /** User-facing message, safe to show in the UI. */
  message: string;
  /** true = stale-race error: skip the toast, cache reconciliation handles it. */
  silent: boolean;
}

interface PgErrorLike {
  message?: string;
  details?: string;
  code?: string;
}

function textOf(err: unknown): string {
  if (!err || typeof err !== "object") return String(err ?? "");
  const e = err as PgErrorLike;
  return [e.message, e.details, e.code].filter(Boolean).join(" | ");
}

const RULES: ReadonlyArray<{
  match: (t: string) => boolean;
  result: FriendlyDbError;
}> = [
  {
    match: (t) => t.includes("one_active_serial_per_customer"),
    result: {
      message: "This customer already has a serial running — only one at a time.",
      silent: false,
    },
  },
  {
    match: (t) => t.includes("shop is not open"),
    result: { message: "Shop is currently closed — open it first.", silent: false },
  },
  {
    match: (t) => t.includes("no chair available"),
    result: {
      message: "No chair is free right now for the selected services.",
      silent: false,
    },
  },
  {
    match: (t) => t.includes("cannot perform"),
    result: {
      message: "This chair doesn't offer that service — pick another chair.",
      silent: false,
    },
  },
  {
    match: (t) => t.includes("only WAITING serials can be moved"),
    result: {
      message: "Only waiting serials can be moved to another chair.",
      silent: false,
    },
  },
  {
    // A racing tap on an already-changed serial: realtime already fixed
    // the board — surface nothing.
    match: (t) => t.includes("invalid status transition"),
    result: { message: "", silent: true },
  },
  {
    // one_in_progress_per_chair unique violation: the lane already has a
    // running job (raced [Start] taps) — reconcile silently.
    match: (t) => t.includes("one_in_progress_per_chair"),
    result: { message: "", silent: true },
  },
  {
    // Postgres deadlock (opposing lane moves) — retryable, tell them to retry.
    match: (t) => t.includes("40P01") || t.toLowerCase().includes("deadlock"),
    result: { message: "Two changes collided — please try again.", silent: false },
  },
  {
    match: (t) => t.includes("invalid service selection"),
    result: { message: "Service selection isn't valid — refresh the list.", silent: false },
  },
  {
    match: (t) => t.includes("আজকে একবার ব্রডকাস্ট পাঠানো হয়ে গেছে"),
    result: {
      message: "আজকে একবার ব্রডকাস্ট পাঠানো হয়ে গেছে — আগামীকাল আবার চেষ্টা করো।",
      silent: false,
    },
  },
  {
    // send_due_reminder's own once-per-day guard on a serial already
    // reminded today — expected when a customer has multiple due serials
    // and only some are rate-limited, so this one stays silent.
    match: (t) => t.includes("আজকে একবার রিমাইন্ডার পাঠানো হয়ে গেছে"),
    result: { message: "", silent: true },
  },
  {
    match: (t) => t.includes("এই সিরিয়ালে বাকি নেই"),
    result: { message: "", silent: true },
  },
];

const FALLBACK: FriendlyDbError = {
  message: "কিছু একটা ভুল হয়েছে — আবার চেষ্টা করো।",
  silent: false,
};

export function translateDbError(err: unknown): FriendlyDbError {
  const t = textOf(err);
  for (const rule of RULES) {
    if (rule.match(t)) return rule.result;
  }
  return FALLBACK;
}

/** Error subclass mutations throw — carries the silent flag to the UI layer. */
export class UiDbError extends Error {
  readonly silent: boolean;
  constructor(friendly: FriendlyDbError) {
    super(friendly.message);
    this.name = "UiDbError";
    this.silent = friendly.silent;
  }
}

/** Wrap any DB-touching promise so callers only ever see UiDbError. */
export async function withDbErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    throw new UiDbError(translateDbError(err));
  }
}