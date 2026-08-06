import { NextResponse } from "next/server";
import webpush from "web-push";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { site } from "@/config/site";

webpush.setVapidDetails(
  `mailto:${site.supportEmail}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

interface NotificationWebhookPayload {
  record?: {
    user_id: string;
    type: string;
    title: string;
    body: string;
  };
}

function deepLinkFor(type: string): string {
  // SYSTEM = platform → user (shop approved/suspended); it belongs in the
  // notification centre, not on the customer's live-serial screen.
  return type === "PROMO" || type === "REMINDER" || type === "SYSTEM"
    ? "/notifications"
    : "/my-serial";
}

/** Called by a Postgres AFTER INSERT trigger on `notifications` (see the
 * push_subscriptions migration) — never invoked directly by the browser. */
export async function POST(req: Request) {
  try {
    if (req.headers.get("x-push-webhook-secret") !== process.env.PUSH_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { record } = (await req.json()) as NotificationWebhookPayload;
    if (!record?.user_id) {
      return NextResponse.json({ error: "bad payload" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", record.user_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 });

    const payload = JSON.stringify({
      title: record.title,
      body: record.body,
      url: deepLinkFor(record.type),
    });

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        ),
      ),
    );

    const expiredEndpoints = results
      .map((r, i) => ({ r, endpoint: subs[i].endpoint }))
      .filter(({ r }) => r.status === "rejected" && isGoneError(r.reason))
      .map(({ endpoint }) => endpoint);

    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }

    return NextResponse.json({ sent: results.filter((r) => r.status === "fulfilled").length });
  } catch (err) {
    // Config not fully wired yet (e.g. SUPABASE_SERVICE_ROLE_KEY unset) or a bad
    // webhook payload — never let this escape as an opaque, bodyless 500.
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isGoneError(reason: unknown): boolean {
  const statusCode = (reason as { statusCode?: number } | null)?.statusCode;
  return statusCode === 404 || statusCode === 410;
}
