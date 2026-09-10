import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * The app's one nightly job.
 *
 * Three things run here — the shop owner's end-of-day summary, any customer
 * self-reminders that came due, and tomorrow's parlour appointments — because
 * all three want daily granularity and none has an event that could trigger it. ("The day ended" is not
 * something the queue ever tells us; everything else in this app rides on a
 * queue event instead, per decision 26.)
 *
 * Vercel Cron rather than pg_cron: no Postgres extension to enable by hand,
 * and it reuses the service-role pattern /api/push/send established. The work
 * itself stays in SQL — this route only decides *when*.
 *
 * Both functions are idempotent (the summary skips a shop that already has one
 * for that date; the reminder rolls its own schedule forward before sending),
 * which is what makes it safe to expose over HTTP where anything could retry.
 */
export async function GET(req: Request) {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET` on every invocation.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getServiceRoleClient();

  // Settled, not sequential: one job failing shouldn't cost the other a whole
  // day, and each is reported separately so a partial night is visible.
  const results = await Promise.allSettled([
    supabase.rpc("send_daily_summaries", { p_day: undefined }),
    supabase.rpc("send_customer_reminders", {}),
    // Tomorrow's parlour appointments. Idempotent through
    // appointments.reminded_at, so a retried night sends nothing twice.
    supabase.rpc("send_appointment_reminders", { p_within_hours: 24 }),
    // Lapsed memberships. Tidy-up rather than correctness: every read path
    // (`membership_is_active()`, and `effectiveStatus()` on the client) checks
    // `expires_at` itself, so a night this misses costs an owner an accurate
    // list and nothing more. Idempotent — a second run flips zero rows.
    supabase.rpc("expire_memberships", {}),
  ]);

  const LABELS = [
    "daily summaries",
    "customer reminders",
    "appointment reminders",
    "membership expiry",
  ];
  const counts = results.map((result, i) => {
    const label = LABELS[i];
    if (result.status === "rejected") {
      console.error(`nightly: ${label} crashed`, result.reason);
      return null;
    }
    if (result.value.error) {
      console.error(`nightly: ${label} failed`, result.value.error);
      return null;
    }
    return (result.value.data as number | null) ?? 0;
  });

  const [summaries, reminders, appointmentReminders, expiredMemberships] = counts;
  if (counts.every((c) => c === null)) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  return NextResponse.json({
    summaries,
    reminders,
    appointmentReminders,
    expiredMemberships,
  });
}
