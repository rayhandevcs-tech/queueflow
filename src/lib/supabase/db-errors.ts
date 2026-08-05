import { translate, type Dict } from "@/lib/i18n";

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

const MESSAGES = {
  oneActiveSerial: {
    bn: "এই কাস্টমারের আগে থেকেই একটা সিরিয়াল চলছে — একসাথে একটাই রাখা যায়।",
    en: "This customer already has a serial running — only one at a time.",
  },
  shopNotOpen: { bn: "দোকান এখন বন্ধ — আগে খুলে নাও।", en: "Shop is currently closed — open it first." },
  noChairAvailable: {
    bn: "বাছাই করা সার্ভিসের জন্য এখন কোনো চেয়ার ফাঁকা নেই।",
    en: "No chair is free right now for the selected services.",
  },
  cannotPerform: {
    bn: "এই চেয়ার ওই সার্ভিসটা করে না — অন্য চেয়ার বেছে নাও।",
    en: "This chair doesn't offer that service — pick another chair.",
  },
  onlyWaitingCanMove: {
    bn: "শুধু অপেক্ষমাণ সিরিয়াল অন্য চেয়ারে সরানো যায়।",
    en: "Only waiting serials can be moved to another chair.",
  },
  collided: { bn: "দুটো পরিবর্তন একসাথে হয়ে গেছে — আবার চেষ্টা করো।", en: "Two changes collided — please try again." },
  invalidServiceSelection: {
    bn: "সার্ভিস বাছাই ঠিক নেই — লিস্ট রিফ্রেশ করো।",
    en: "Service selection isn't valid — refresh the list.",
  },
  broadcastAlreadySentToday: {
    bn: "আজকে একবার ব্রডকাস্ট পাঠানো হয়ে গেছে — আগামীকাল আবার চেষ্টা করো।",
    en: "You've already sent a broadcast today — try again tomorrow.",
  },
  reminderMuted: {
    bn: "এই কাস্টমার রিমাইন্ডার নোটিফিকেশন বন্ধ রেখেছে।",
    en: "This customer has muted reminder notifications.",
  },
  ownsShop: {
    bn: "তোমার নামে দোকান আছে — অ্যাকাউন্ট মুছার আগে সাপোর্টে যোগাযোগ করো।",
    en: "You own a shop — contact support before deleting your account.",
  },
  accountBlocked: {
    bn: "তোমার অ্যাকাউন্ট আপাতত সীমিত — নতুন সিরিয়াল, রিভিউ বা মেসেজ পাঠানো যাচ্ছে না। বিস্তারিত জানতে সাপোর্টে যোগাযোগ করো।",
    en: "Your account is restricted — you can't book, review or message right now. Contact support for details.",
  },
  generic: { bn: "কিছু একটা ভুল হয়েছে — আবার চেষ্টা করো।", en: "Something went wrong — try again." },
} satisfies Dict;

const RULES: ReadonlyArray<{
  match: (t: string) => boolean;
  key: keyof typeof MESSAGES | null;
  silent: boolean;
}> = [
  { match: (t) => t.includes("one_active_serial_per_customer"), key: "oneActiveSerial", silent: false },
  { match: (t) => t.includes("shop is not open"), key: "shopNotOpen", silent: false },
  { match: (t) => t.includes("no chair available"), key: "noChairAvailable", silent: false },
  { match: (t) => t.includes("cannot perform"), key: "cannotPerform", silent: false },
  { match: (t) => t.includes("only WAITING serials can be moved"), key: "onlyWaitingCanMove", silent: false },
  {
    // A racing tap on an already-changed serial: realtime already fixed
    // the board — surface nothing.
    match: (t) => t.includes("invalid status transition"),
    key: null,
    silent: true,
  },
  {
    // one_in_progress_per_chair unique violation: the lane already has a
    // running job (raced [Start] taps) — reconcile silently.
    match: (t) => t.includes("one_in_progress_per_chair"),
    key: null,
    silent: true,
  },
  {
    // Postgres deadlock (opposing lane moves) — retryable, tell them to retry.
    match: (t) => t.includes("40P01") || t.toLowerCase().includes("deadlock"),
    key: "collided",
    silent: false,
  },
  { match: (t) => t.includes("invalid service selection"), key: "invalidServiceSelection", silent: false },
  {
    match: (t) => t.includes("আজকে একবার ব্রডকাস্ট পাঠানো হয়ে গেছে"),
    key: "broadcastAlreadySentToday",
    silent: false,
  },
  {
    // send_due_reminder's own once-per-day guard on a serial already
    // reminded today — expected when a customer has multiple due serials
    // and only some are rate-limited, so this one stays silent.
    match: (t) => t.includes("আজকে একবার রিমাইন্ডার পাঠানো হয়ে গেছে"),
    key: null,
    silent: true,
  },
  { match: (t) => t.includes("এই সিরিয়ালে বাকি নেই"), key: null, silent: true },
  { match: (t) => t.includes("রিমাইন্ডার নোটিফিকেশন বন্ধ রেখেছে"), key: "reminderMuted", silent: false },
  { match: (t) => t.includes("তোমার নামে দোকান আছে"), key: "ownsShop", silent: false },
  {
    // Raised by reject_blocked_customer/reject_blocked_author (Sprint 26) on
    // booking, review and chat inserts — keep the string in sync with the
    // triggers in 20260825_admin_users_moderation.sql.
    match: (t) => t.includes("account_blocked"),
    key: "accountBlocked",
    silent: false,
  },
];

export function translateDbError(err: unknown): FriendlyDbError {
  const t = textOf(err);
  for (const rule of RULES) {
    if (rule.match(t)) {
      return { message: rule.key ? translate(MESSAGES, rule.key) : "", silent: rule.silent };
    }
  }
  return { message: translate(MESSAGES, "generic"), silent: false };
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
