import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { getServiceRoleClient, SERVICE_ROLE_MISSING } from "@/lib/supabase/service-role";
import type { Database } from "@/types/database.types";
import type { AdminLevel } from "@/types";

type Client = SupabaseClient<Database>;

export interface AdminContext {
  /** The signed-in human, from their session cookie. */
  userId: string;
  level: AdminLevel;
  /** Acts as the signed-in admin — RLS and auth.uid() apply. */
  session: Client;
  /** Bypasses RLS and can reach the auth schema. Server-only. */
  service: Client;
}

/**
 * The two-step check both admin routes start with, in one place so they cannot
 * drift apart: the session cookie says who is asking, then admin_users is read
 * with the service role to confirm the membership. The caller's own claim
 * (app_metadata.is_admin) is never trusted — it is a token snapshot that
 * survives a revoked membership until the next refresh.
 *
 * Returns either a context or the response to send back. Every failure gets a
 * message you can act on: a 500 that only says "forbidden" is what makes a
 * missing env var look like a permissions bug.
 */
export async function requireAdmin(
  minimum?: AdminLevel,
): Promise<{ ctx: AdminContext } | { response: NextResponse }> {
  const session = await createServerSupabase();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  let service: Client;
  try {
    service = getServiceRoleClient();
  } catch (error) {
    const missing = error instanceof Error && error.message === SERVICE_ROLE_MISSING;
    return {
      response: NextResponse.json(
        {
          error: missing
            ? "সার্ভারে SUPABASE_SERVICE_ROLE_KEY সেট করা নেই — হোস্টিং-এর Environment Variables-এ যোগ করে আবার deploy করো"
            : "সার্ভার কনফিগারেশনে সমস্যা",
        },
        { status: 500 },
      ),
    };
  }

  const { data: actor, error: actorError } = await service
    .from("admin_users")
    .select("user_id, level, status")
    .eq("user_id", user.id)
    .maybeSingle();

  // A failed *query* is not a failed authorisation. The usual cause is
  // admin_users.status not existing yet, i.e. 20260901_admin_identity.sql was
  // never run — reporting that as "forbidden" hides the only useful fact.
  if (actorError) {
    return {
      response: NextResponse.json(
        {
          error: /status/.test(actorError.message)
            ? "ডেটাবেস মাইগ্রেশন বাকি আছে — 20260901_admin_identity.sql চালাও"
            : actorError.message,
        },
        { status: 500 },
      ),
    };
  }

  if (!actor || actor.status !== "ACTIVE") {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  if (minimum && actor.level !== minimum) {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  return {
    ctx: {
      userId: user.id,
      level: actor.level as AdminLevel,
      session,
      service,
    },
  };
}
