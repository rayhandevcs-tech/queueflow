import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * The app's one nightly job.
 *
 * Two things run here — the shop owner's end-of-day summary, and any customer
 * self-reminders that came due — because both want daily granularity and
 * neither has an event that could trigger it. ("The day ended" is not
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
  ]);

  const counts = results.map((result, i) => {
    const label = i === 0 ? "daily summaries" : "customer reminders";
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

  const [summaries, reminders] = counts;
  if (summaries === null && reminders === null) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  return NextResponse.json({ summaries, reminders });
}
