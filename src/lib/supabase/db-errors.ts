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
  notAcceptingNew: {
    bn: "এই দোকান এখন নতুন সিরিয়াল নিচ্ছে না — চলমান কিউ শেষ করছে।",
    en: "This shop has stopped taking new serials — it's finishing the current queue.",
  },
  noShowRequiresCall: {
    bn: "আগে কাস্টমারকে ডাকো — না ডেকে নো-শো দেওয়া যায় না। আসবে না জানলে বাতিল করো।",
    en: "Call the customer first — you can't mark a no-show without calling. If you know they aren't coming, cancel instead.",
  },
  noShowGracePeriod: {
    bn: "ডাকার পর ৫ মিনিট অপেক্ষা করতে হবে — তারপর নো-শো দেওয়া যাবে।",
    en: "Wait 5 minutes after calling — then you can mark a no-show.",
  },
  nothingToBump: {
    bn: "পেছনে আর কেউ নেই — পিছিয়ে দেওয়ার জায়গা নেই।",
    en: "Nobody is behind them — there's no slot to bump into.",
  },
  invalidPartySize: {
    bn: "একসাথে সর্বোচ্চ ৫ জনের সিরিয়াল নেওয়া যায়।",
    en: "You can book for at most 5 people at once.",
  },
  duplicateChair: {
    bn: "এই নামের বা এই অবস্থানের একটা চেয়ার আগে থেকেই আছে — নাম বদলে আবার চেষ্টা করো।",
    en: "A chair with that name or position already exists — try a different name.",
  },
  serialNotWaiting: {
    bn: "সিরিয়ালটা আর অপেক্ষায় নেই — বোর্ড রিফ্রেশ করে দেখো।",
    en: "That serial isn't waiting any more — refresh the board.",
  },
  notYourShop: {
    bn: "এই সিরিয়ালটা তোমার দোকানের নয়।",
    en: "That serial doesn't belong to your shop.",
  },
  serialNotFound: {
    bn: "সিরিয়ালটা পাওয়া যায়নি — সম্ভবত এর মধ্যেই সরে গেছে।",
    en: "Serial not found — it has probably already moved on.",
  },
  migrationMissing: {
    bn: "এই ফিচারের ডেটাবেস আপডেটটা এখনো চালানো হয়নি — supabase/migrations ফোল্ডারের বাকি ফাইলগুলো SQL এডিটরে চালাও।",
    en: "The database update for this feature hasn't been run yet — apply the remaining files in supabase/migrations.",
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
  {
    // A duplicate on the chairs table specifically — "try again" is useless
    // advice here, since retrying the same values collides the same way.
    match: (t) => t.includes("chairs_") && (t.includes("23505") || t.includes("duplicate key")),
    key: "duplicateChair",
    silent: false,
  },
  {
    // Any other unique violation on a queue write — two people reordering the
    // same lane at once. PostgREST returns it as a bare 409, which reached the
    // user as "something went wrong"; retrying is the right advice and it is
    // what the deadlock case already says.
    match: (t) => t.includes("23505") || t.includes("duplicate key value"),
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
  // Sprint 28 — keep these strings in sync with 20260827_wait_reality.sql.
  { match: (t) => t.includes("shop is not accepting new bookings"), key: "notAcceptingNew", silent: false },
  { match: (t) => t.includes("no_show_requires_call"), key: "noShowRequiresCall", silent: false },
  { match: (t) => t.includes("no_show_grace_period"), key: "noShowGracePeriod", silent: false },
  { match: (t) => t.includes("nothing_to_bump"), key: "nothingToBump", silent: false },
  // The other three exceptions bump_serial_back / mark_serial_called can raise.
  // They were never mapped, so every one of them reached the user as the
  // generic "something went wrong" — which is exactly what made the back
  // button look broken rather than refused, and sent the search for a cause
  // into the UI instead of the queue's state.
  { match: (t) => t.includes("serial is not waiting"), key: "serialNotWaiting", silent: false },
  { match: (t) => t.includes("not your shop"), key: "notYourShop", silent: false },
  { match: (t) => t.includes("serial not found"), key: "serialNotFound", silent: false },
  // Sprint 29 — party rules (20260828_group_booking.sql). `party_lead_missing`
  // means the lead was cancelled out from under a follower mid-insert; from
  // the customer's side that reads as "you already have a booking", which the
  // one-active-serial message says better than any wording of its own.
  { match: (t) => t.includes("invalid_party_size"), key: "invalidPartySize", silent: false },
  { match: (t) => t.includes("party_lead_missing"), key: "oneActiveSerial", silent: false },
  {
    // An RPC or table this build calls that the database does not have — i.e.
    // a migration in supabase/migrations that was never applied. It used to
    // fall through to "something went wrong", which sends you hunting through
    // the UI for a bug that is not in the UI at all. PGRST202 = function not
    // found, PGRST205 = table not found; 42883/42P01 are the Postgres codes
    // behind them.
    match: (t) =>
      t.includes("PGRST202") ||
      t.includes("PGRST205") ||
      t.includes("42883") ||
      t.includes("42P01") ||
      t.includes("Could not find the function") ||
      t.includes("Could not find the table") ||
      t.includes("schema cache"),
    key: "migrationMissing",
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
