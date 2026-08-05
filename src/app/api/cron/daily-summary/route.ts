import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * The nightly "আজকের হিসাব" push.
 *
 * Why an HTTP route and a Vercel cron rather than pg_cron: this is the first
 * genuinely time-driven job in the app (decision 26 kept everything else on
 * queue events), and the deployment is already on Vercel. Scheduling here
 * needs no Postgres extension enabled by hand, and it reuses the service-role
 * pattern /api/push/send established. The actual work stays in SQL — this
 * route only decides *when*.
 *
 * send_daily_summaries() is idempotent: it skips a shop that already has a
 * summary for that date. A retried or double-fired cron therefore costs
 * nothing, which is what makes it safe to expose over HTTP at all.
 */
export async function GET(req: Request) {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET` on every invocation.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.rpc("send_daily_summaries", { p_day: undefined });

    if (error) {
      console.error("daily-summary failed", error);
      return NextResponse.json({ error: "failed" }, { status: 500 });
    }

    return NextResponse.json({ sent: data ?? 0 });
  } catch (err) {
    console.error("daily-summary crashed", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
