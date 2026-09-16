/**
 * "2026-09-09" in local time — a calendar day's identity.
 *
 * Used as a query-key segment and as the `p_date` argument to
 * `shop_available_slots`. It lives in shared rather than in either feature
 * because the provider's board and the customer's booking sheet both need to
 * name the same day, and features may not import each other.
 *
 * Not `toISOString().slice(0, 10)`: that converts to UTC first, so in Dhaka
 * (UTC+6) every call before 6am would name the previous day.
 */
export function ymd(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Dhaka is UTC+6, with no daylight saving — so a fixed offset is correct. */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/**
 * The calendar day an instant falls on **in the shop's timezone**.
 *
 * `ymd()` above is right for the browser, where local time already is the
 * shop's time. This one is for the server, where it is not: a Node process
 * runs in UTC, so `ymd(new Date("2026-09-17T19:00:00Z"))` names the 17th when
 * the shop is already into the 18th.
 *
 * It matters in exactly one place today, and the failure would have been
 * quiet. `prepare_book_appointment` re-queries `shop_available_slots()` to
 * confirm a slot is still free, and that RPC takes a `p_date`. Derive the date
 * in UTC and a 5pm Dhaka slot late in the evening is looked up on the wrong
 * day, the RPC returns nothing for it, and the customer is told the time has
 * gone — a refusal that looks exactly like a slot somebody else took.
 *
 * `public.shop_timezone()` is the database's matching authority, and it also
 * returns a constant today. Both are the seam for a future `shops.timezone`
 * column and both are the only place the constant appears on their side.
 */
export function dhakaDayKey(instant: Date | string | number): string {
  const ms =
    instant instanceof Date
      ? instant.getTime()
      : typeof instant === "number"
        ? instant
        : Date.parse(instant);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}
