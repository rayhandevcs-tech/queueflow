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

/**
 * The raw server message, for screens that show a failure verbatim rather than
 * translating it.
 *
 * Supabase rejects with a PLAIN OBJECT, not an Error — so the obvious
 * `err instanceof Error ? err.message : String(err)` renders "[object Object]"
 * and throws away the one thing worth reading. Postgres puts the actionable
 * part in `hint` and `details` as often as in `message`, so all of them come
 * through.
 */
export function describeDbError(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;

  if (typeof err === "object") {
    const e = err as PgErrorLike & { hint?: string };
    const parts = [e.message, e.details, e.hint].filter(Boolean);
    if (parts.length) {
      return e.code ? `${parts.join(" — ")} (${e.code})` : parts.join(" — ");
    }
  }

  return err instanceof Error ? err.message : JSON.stringify(err);
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
  slotTaken: {
    bn: "এই সময়টা এইমাত্র কেউ নিয়ে নিয়েছে — অন্য একটা সময় বেছে নাও।",
    en: "Someone just took that time — pick another one.",
  },
  appointmentInPast: {
    bn: "যে সময় পেরিয়ে গেছে সেখানে বুক করা যায় না।",
    en: "You can't book a time that has already passed.",
  },
  outsideWorkingHours: {
    bn: "এই সময়টা দোকানের খোলা সময়ের বাইরে পড়ে যাচ্ছে।",
    en: "That time falls outside the shop's opening hours.",
  },
  shopClosedThatDay: {
    bn: "ওই দিন দোকান বন্ধ — অন্য একটা দিন বেছে নাও।",
    en: "The shop is closed that day — pick another one.",
  },
  staffNotInShop: {
    bn: "এই স্টাফ এই দোকানের নয় বা এখন বন্ধ আছে।",
    en: "That staff member isn't at this shop, or is paused.",
  },
  staffCannotPerform: {
    bn: "এই স্টাফ বাছাই করা সব সার্ভিস করে না — অন্য কাউকে বেছে নাও।",
    en: "That staff member doesn't do all the selected services — pick someone else.",
  },
  staffOnLeave: {
    bn: "এই বিউটিশিয়ান ওই সময়ে ছুটিতে — অন্য সময় বা অন্য কাউকে বেছে নাও।",
    en: "That beautician is on leave then — pick another time or another person.",
  },
  staffNotWorking: {
    bn: "এই বিউটিশিয়ান ওই দিনে কাজ করেন না।",
    en: "That beautician doesn't work that day.",
  },
  staffInactive: {
    bn: "এই সিটটা এখন বন্ধ আছে।",
    en: "That seat is paused right now.",
  },
  notReschedulable: {
    bn: "শেষ বা বাতিল হয়ে যাওয়া অ্যাপয়েন্টমেন্ট সরানো যায় না।",
    en: "A finished or cancelled appointment can't be moved.",
  },
  appointmentNotFound: {
    bn: "অ্যাপয়েন্টমেন্টটা পাওয়া যায়নি।",
    en: "That appointment couldn't be found.",
  },
  shopNotActive: {
    bn: "এই দোকান এখন অ্যাপয়েন্টমেন্ট নিচ্ছে না।",
    en: "This shop isn't taking appointments right now.",
  },
  // Sprint 6 — membership. Keep in sync with 20260921_membership.sql.
  membershipAlreadyLive: {
    bn: "এই দোকানে একটা সদস্যপদ ইতিমধ্যেই চলছে — একসাথে একটাই রাখা যায়।",
    en: "There's already a live membership here — only one at a time.",
  },
  membershipTierGone: {
    bn: "প্যাকেজটা আর নেই — পাতাটা রিফ্রেশ করে দেখো।",
    en: "That package no longer exists — refresh the page.",
  },
  membershipTierWrongShop: {
    bn: "প্যাকেজটা এই দোকানের নয়।",
    en: "That package doesn't belong to this shop.",
  },
  membershipTierInactive: {
    bn: "প্যাকেজটা এখন বন্ধ আছে, তাই নেওয়া যাবে না।",
    en: "That package is switched off, so it can't be joined.",
  },
  membershipTierNameTaken: {
    bn: "এই নামে তোমার একটা প্যাকেজ আছেই — অন্য নাম দাও।",
    en: "You already have a package by that name — pick another.",
  },
  membershipTierHasMembers: {
    bn: "এই প্যাকেজে সদস্য আছে, তাই মোছা যাবে না। 'বন্ধ' করে দাও।",
    en: "This package has members, so it can't be deleted. Switch it off instead.",
  },
  // Sprint 7 — loyalty. Keep in sync with 20260922_loyalty.sql.
  loyaltyBalanceNegative: {
    bn: "এতে ব্যালেন্স শূন্যের নিচে চলে যায় — কম পয়েন্ট বাদ দাও।",
    en: "That would take the balance below zero — remove fewer points.",
  },
  loyaltyPointsZero: {
    bn: "কত পয়েন্ট ঠিক করতে চাও সেটা লেখো (+ বা −)।",
    en: "Say how many points to change (+ or −).",
  },
  loyaltyAlreadyAwarded: {
    bn: "এই কাজে পয়েন্ট আগেই জমা হয়েছে।",
    en: "Points for that job have already been awarded.",
  },
  loyaltyNeedsCustomer: {
    bn: "অ্যাকাউন্ট ছাড়া কাস্টমারের পয়েন্ট জমানো যায় না।",
    en: "Points need a customer with an account.",
  },
  // Sprint 8 — referral. Keep in sync with 20260923_referral.sql.
  referralNotEnabled: {
    bn: "এই দোকানে রেফারেল এখন চালু নেই।",
    en: "This shop isn't running referrals right now.",
  },
  referralCodeInvalid: {
    bn: "কোডটা লেখো — খালি রাখা যাবে না।",
    en: "Type the code — it can't be empty.",
  },
  referralCodeNotFound: {
    bn: "এই দোকানে এই কোডটা নেই। বানানটা আরেকবার দেখো — অন্য দোকানের কোড এখানে চলে না।",
    en: "No such code at this shop. Check the spelling — a code from another shop won't work here.",
  },
  referralSelfNotAllowed: {
    bn: "নিজের কোড নিজে ব্যবহার করা যায় না।",
    en: "You can't use your own code.",
  },
  referralNotNewCustomer: {
    bn: "এই দোকানে তোমার কাজ আগেই হয়ে গেছে, তাই রেফারেল কোড আর লাগানো যাবে না — এটা শুধু প্রথমবারের জন্য।",
    en: "You've already been served here, so a referral code no longer applies — it's for a first visit only.",
  },
  referralAlreadyClaimed: {
    bn: "এই দোকানে তুমি আগেই একটা রেফারেল কোড দিয়েছ — একবারই দেওয়া যায়।",
    en: "You've already applied a referral code at this shop — only one is allowed.",
  },
  referralLoginRequired: {
    bn: "রেফারেল কোড দিতে বা নিতে লগইন করতে হবে।",
    en: "Log in to get or apply a referral code.",
  },
  referralAlreadyRewarded: {
    bn: "এই রেফারেলের পয়েন্ট আগেই জমা হয়েছে।",
    en: "Points for that referral have already been awarded.",
  },
  referralCodeUnavailable: {
    bn: "কোড বানানো গেল না — আরেকবার চেষ্টা করো।",
    en: "Couldn't mint a code — please try again.",
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
  // ---------------------------------------------------------------------
  // Named unique indexes — these MUST stay above the catch-all below.
  // ---------------------------------------------------------------------
  // A unique violation arrives carrying `23505`, so the generic rule that
  // follows matches every one of them. These were originally written below
  // it, which made them unreachable and turned "you are already a member"
  // into "two changes collided". Which index fired *is* the message here, so
  // they are matched first.
  {
    match: (t) => t.includes("customer_memberships_one_live_idx"),
    key: "membershipAlreadyLive",
    silent: false,
  },
  {
    match: (t) => t.includes("membership_tiers_shop_name_idx"),
    key: "membershipTierNameTaken",
    silent: false,
  },
  {
    match: (t) =>
      t.includes("loyalty_tx_one_per_serial_idx") ||
      t.includes("loyalty_tx_one_per_appointment_idx"),
    key: "loyaltyAlreadyAwarded",
    silent: false,
  },
  {
    match: (t) => t.includes("loyalty_tx_one_per_referral_side_idx"),
    key: "referralAlreadyRewarded",
    silent: false,
  },
  {
    // The one-claim-per-shop index. claim_referral() already translates this
    // into `referral_already_claimed`, so reaching here means a direct write
    // or a future caller — either way the message is the same.
    match: (t) => t.includes("referrals_one_per_shop"),
    key: "referralAlreadyClaimed",
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
  // Sprint 4 — keep these strings in sync with 20260918_appointment_core.sql.
  {
    // book_appointment() translates the exclusion constraint into this; the
    // raw constraint name is matched too, for a direct insert.
    match: (t) => t.includes("slot_taken") || t.includes("appointments_no_overlap"),
    key: "slotTaken",
    silent: false,
  },
  { match: (t) => t.includes("appointment_in_past"), key: "appointmentInPast", silent: false },
  { match: (t) => t.includes("outside_working_hours"), key: "outsideWorkingHours", silent: false },
  { match: (t) => t.includes("shop_closed_that_day"), key: "shopClosedThatDay", silent: false },
  { match: (t) => t.includes("staff does not belong"), key: "staffNotInShop", silent: false },
  { match: (t) => t.includes("selected staff cannot perform"), key: "staffCannotPerform", silent: false },
  // Sprint 5 — keep in sync with 20260919_appointment_availability.sql.
  { match: (t) => t.includes("staff_on_leave"), key: "staffOnLeave", silent: false },
  { match: (t) => t.includes("staff_not_working_that_day"), key: "staffNotWorking", silent: false },
  { match: (t) => t.includes("staff_inactive"), key: "staffInactive", silent: false },
  { match: (t) => t.includes("appointment_not_reschedulable"), key: "notReschedulable", silent: false },
  { match: (t) => t.includes("appointment_not_found"), key: "appointmentNotFound", silent: false },
  { match: (t) => t.includes("shop is not active"), key: "shopNotActive", silent: false },
  // Sprint 6 — membership (20260921_membership.sql). Its two unique-index
  // rules live in the named-index block above, because a unique violation
  // matches the catch-all duplicate-key rule otherwise.
  { match: (t) => t.includes("membership_tier_not_found"), key: "membershipTierGone", silent: false },
  {
    match: (t) => t.includes("membership_tier_wrong_shop"),
    key: "membershipTierWrongShop",
    silent: false,
  },
  {
    match: (t) => t.includes("membership_tier_inactive"),
    key: "membershipTierInactive",
    silent: false,
  },
  {
    // The FK's on-delete-restrict firing: a tier that has been sold cannot be
    // deleted, only switched off.
    match: (t) => t.includes("customer_memberships_tier_id_fkey"),
    key: "membershipTierHasMembers",
    silent: false,
  },
  {
    // A racing tap on an already-advanced membership — the list has already
    // refetched, so there is nothing useful to say.
    match: (t) => t.includes("invalid membership status transition"),
    key: null,
    silent: true,
  },
  // Sprint 7 — loyalty (20260922_loyalty.sql). Its per-job index rules also
  // live in the named-index block above, for the same reason.
  {
    match: (t) => t.includes("loyalty_balance_cannot_go_negative"),
    key: "loyaltyBalanceNegative",
    silent: false,
  },
  {
    match: (t) =>
      t.includes("loyalty_points_must_not_be_zero") ||
      t.includes("loyalty_points_must_be_positive"),
    key: "loyaltyPointsZero",
    silent: false,
  },
  {
    match: (t) => t.includes("loyalty_needs_a_customer"),
    key: "loyaltyNeedsCustomer",
    silent: false,
  },
  // Sprint 8 — referral (20260923_referral.sql). Every one of these is a
  // deliberate refusal from claim_referral() or my_referral_code(), and each
  // one needs its own answer: "wrong shop", "your own code" and "too late"
  // send the customer to three different places.
  {
    match: (t) => t.includes("referral_not_enabled"),
    key: "referralNotEnabled",
    silent: false,
  },
  {
    match: (t) => t.includes("referral_code_not_found"),
    key: "referralCodeNotFound",
    silent: false,
  },
  {
    match: (t) => t.includes("referral_code_invalid"),
    key: "referralCodeInvalid",
    silent: false,
  },
  {
    match: (t) => t.includes("referral_self_not_allowed"),
    key: "referralSelfNotAllowed",
    silent: false,
  },
  {
    match: (t) => t.includes("referral_not_a_new_customer"),
    key: "referralNotNewCustomer",
    silent: false,
  },
  {
    match: (t) => t.includes("referral_already_claimed"),
    key: "referralAlreadyClaimed",
    silent: false,
  },
  {
    match: (t) => t.includes("referral_requires_login"),
    key: "referralLoginRequired",
    silent: false,
  },
  {
    match: (t) => t.includes("referral_code_generation_failed"),
    key: "referralCodeUnavailable",
    silent: false,
  },
  {
    // referral_convert() refusing a second conversion, or referral_award_points
    // refusing a still-pending one. Both mean the reward is already settled or
    // not yet due — a racing tap, so nothing useful to say.
    match: (t) =>
      t.includes("referral_not_converted") ||
      t.includes("referral_conversion_is_final") ||
      t.includes("referral_needs_exactly_one_qualifying_booking"),
    key: null,
    silent: true,
  },
  {
    // Same reasoning as the queue's: realtime/refetch has already corrected
    // the board, so a racing tap needs no toast.
    match: (t) => t.includes("invalid appointment status transition"),
    key: null,
    silent: true,
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
