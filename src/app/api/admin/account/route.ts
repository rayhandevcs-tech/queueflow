import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Auth-level account repairs an admin can run from /admin/users/[userId].
 *
 * These three live here rather than in a SQL function because they touch the
 * `auth` schema, where hand-written UPDATEs go wrong quietly: an email lives on
 * auth.users AND on the row in auth.identities that password sign-in actually
 * resolves against, so changing one without the other locks the user out.
 * Supabase's Admin API keeps them consistent — everything else stays in the
 * SECURITY DEFINER RPCs (see 20260826_admin_account_ops.sql).
 *
 * Authorisation is two-step and never trusts the caller's own claim: the
 * request's session cookie identifies who is asking, then admin_users is
 * checked with the service role before anything is done.
 */

type Action = "confirm_email" | "change_email" | "send_password_reset";

interface Body {
  action?: Action;
  userId?: string;
  email?: string;
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getServiceRoleClient();

  const { data: adminRow } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const { action, userId, email } = body;
  if (!action || !userId) {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  // An admin repairing another admin's login is fine; an admin re-pointing a
  // *platform admin's* email at an address they control is not.
  if (userId !== user.id) {
    const { data: targetIsAdmin } = await admin
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (targetIsAdmin && action === "change_email") {
      return NextResponse.json({ error: "cannot change an admin's email" }, { status: 403 });
    }
  }

  const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
  if (targetError || !target?.user) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  try {
    switch (action) {
      case "confirm_email": {
        const { error } = await admin.auth.admin.updateUserById(userId, {
          email_confirm: true,
        });
        if (error) throw error;
        break;
      }

      case "change_email": {
        const next = email?.trim().toLowerCase();
        if (!next || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
          return NextResponse.json({ error: "invalid email" }, { status: 400 });
        }
        // email_confirm: the admin is vouching for the address, so the user
        // isn't locked out waiting for a confirmation mail they may not get.
        const { error } = await admin.auth.admin.updateUserById(userId, {
          email: next,
          email_confirm: true,
        });
        if (error) throw error;
        break;
      }

      case "send_password_reset": {
        const address = target.user.email;
        if (!address) {
          return NextResponse.json({ error: "user has no email" }, { status: 400 });
        }
        const { error } = await supabase.auth.resetPasswordForEmail(address, {
          redirectTo: `${new URL(req.url).origin}/reset-password`,
        });
        if (error) throw error;
        break;
      }

      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Same audit trail as the SQL RPCs. Written with the service role because
  // admin_log() is deliberately not executable by a client role.
  await admin.from("admin_audit_log").insert({
    actor_id: user.id,
    action: `USER_${action.toUpperCase()}`,
    target_type: "user",
    target_id: userId,
    meta: action === "change_email" ? { email } : {},
  });

  return NextResponse.json({ ok: true });
}
