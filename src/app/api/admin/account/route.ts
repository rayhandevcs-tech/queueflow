import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin, type AdminContext } from "../_guard";

/**
 * Auth-level account operations an admin can run from /admin/users/[userId].
 *
 * These live here rather than in a SQL function because they touch the `auth`
 * schema, where hand-written statements go wrong quietly: an email lives on
 * auth.users AND on the row in auth.identities that password sign-in actually
 * resolves against, and a user has sessions, refresh tokens, MFA factors and
 * one-time tokens hanging off it besides. Supabase's Admin API keeps all of
 * that consistent — everything else stays in the SECURITY DEFINER RPCs.
 *
 * Authorisation is two-step and never trusts the caller's own claim; see
 * requireAdmin.
 */

type Action = "confirm_email" | "change_email" | "send_password_reset" | "delete_account";

interface Body {
  action?: Action;
  userId?: string;
  email?: string;
  reason?: string | null;
}

/**
 * A recovery mail sent on someone else's behalf must NOT use PKCE.
 *
 * Under PKCE the code verifier is written to the cookie jar of whoever made
 * the request — here, the admin's browser. The link then lands in the user's
 * inbox carrying a `code` that only the admin's browser could exchange, so the
 * recipient gets "link invalid" every time. An implicit-flow client sends a
 * link that carries the session itself, which is what makes it usable by the
 * person who received it.
 */
function implicitFlowClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { ctx } = guard;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const { action, userId, email, reason } = body;
  if (!action || !userId) {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  // An admin repairing another admin's login is fine; an admin re-pointing a
  // *platform admin's* email at an address they control is not, and deleting
  // one outright is refused in SQL too.
  if (userId !== ctx.userId && (action === "change_email" || action === "delete_account")) {
    const { data: targetIsAdmin } = await ctx.service
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (targetIsAdmin) {
      return NextResponse.json(
        { error: "প্ল্যাটফর্ম এডমিনের অ্যাকাউন্টে এটা করা যাবে না" },
        { status: 403 },
      );
    }
  }
  if (userId === ctx.userId && action === "delete_account") {
    return NextResponse.json({ error: "নিজের অ্যাকাউন্ট মোছা যাবে না" }, { status: 403 });
  }

  const { data: target, error: targetError } = await ctx.service.auth.admin.getUserById(userId);
  if (targetError || !target?.user) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  try {
    switch (action) {
      case "confirm_email": {
        const { error } = await ctx.service.auth.admin.updateUserById(userId, {
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
        const { error } = await ctx.service.auth.admin.updateUserById(userId, {
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
        const { error } = await implicitFlowClient().auth.resetPasswordForEmail(address, {
          redirectTo: `${new URL(req.url).origin}/reset-password`,
        });
        if (error) throw error;
        break;
      }

      case "delete_account": {
        const result = await deleteAccount(ctx, userId, reason ?? null);
        if ("error" in result) return result.error;
        return NextResponse.json(result.data);
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
  await ctx.service.from("admin_audit_log").insert({
    actor_id: ctx.userId,
    action: `USER_${action.toUpperCase()}`,
    target_type: "user",
    target_id: userId,
    meta: action === "change_email" ? { email } : {},
  });

  return NextResponse.json({ ok: true });
}

/**
 * Permanent account deletion, in two halves.
 *
 * The public schema is torn down by admin_delete_user() — one transaction,
 * running as the signed-in admin so is_platform_admin() and the audit row are
 * both real. The auth.users row is then removed by the Admin API rather than
 * by that function, and THAT is the fix: deleting auth.users with a plain SQL
 * DELETE left the address unusable for re-registration, because the rows
 * password sign-in resolves against (auth.identities, and the sessions and
 * one-time tokens beside it) are GoTrue's to clean up, not ours. The old path
 * freed the users row and stranded the identity, so signing up again with the
 * same email came back "already registered" against a user that no longer
 * existed.
 *
 * Order matters: the RPC first, because its authorisation and its audit entry
 * both read data the deletion destroys.
 */
async function deleteAccount(
  ctx: AdminContext,
  userId: string,
  reason: string | null,
): Promise<{ data: unknown } | { error: NextResponse }> {
  const { data, error } = await ctx.session.rpc("admin_delete_user", {
    p_user_id: userId,
    p_reason: reason?.trim() || null,
  });

  // "user not found" means the profile is already gone — which is exactly the
  // state a half-finished deletion leaves behind. Retrying should finish the
  // job rather than refuse it, so only that one case falls through.
  if (error && !/user not found/i.test(error.message)) {
    return { error: NextResponse.json({ error: error.message }, { status: 400 }) };
  }

  const { error: authError } = await ctx.service.auth.admin.deleteUser(userId);
  if (authError) {
    return {
      error: NextResponse.json(
        { error: `অ্যাকাউন্টের ডেটা মোছা হয়েছে, কিন্তু লগইনটি মোছা যায়নি: ${authError.message}` },
        { status: 400 },
      ),
    };
  }

  return { data: data ?? { email: null } };
}
