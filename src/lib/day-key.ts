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
