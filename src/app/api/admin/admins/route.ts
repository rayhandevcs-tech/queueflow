import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import type { AdminLevel } from "@/types";

/**
 * Creating an admin account.
 *
 * This is a server route rather than a SQL function for one reason: the
 * auth.users row needs a hashed password and a confirmed email, and that is
 * Supabase's Admin API's job — hand-writing into the auth schema is how
 * accounts end up unable to sign in (see the note in /api/admin/account).
 *
 * Authorisation is two-step and never trusts the caller's own claim (see
 * requireAdmin). admin_provision_admin() re-checks the same thing in SQL, so
 * neither layer is load-bearing alone.
 *
 * email_confirm: true is deliberate. An admin is vouched for by another admin,
 * not by a confirmation mail — and making the panel's access depend on inbox
 * delivery is exactly the failure this fixes elsewhere.
 */

const LEVELS: readonly AdminLevel[] = ["SUPER_ADMIN", "MODERATOR", "SUPPORT"];

interface Body {
  fullName?: string;
  email?: string;
  password?: string;
  level?: AdminLevel;
}

export async function POST(req: Request) {
  const guard = await requireAdmin("SUPER_ADMIN");
  if ("response" in guard) return guard.response;
  const { ctx } = guard;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const fullName = body.fullName?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const level = body.level;

  if (!fullName || fullName.length < 2) {
    return NextResponse.json({ error: "নাম দাও" }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "ঠিক ইমেইল দাও" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে" }, { status: 400 });
  }
  if (!level || !LEVELS.includes(level)) {
    return NextResponse.json({ error: "রোল বেছে নাও" }, { status: 400 });
  }

  const { data: created, error: createError } = await ctx.service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      is_admin_account: true,
      // `role` is here only to satisfy the baseline signup trigger, which reads
      // it and writes a NOT NULL profiles.role. Omitting it aborted the whole
      // createUser call with "Database error creating new user" — the account
      // was never created, so the panel could not add admins at all. The row
      // the trigger writes is deleted a few lines below by
      // admin_provision_admin(); that deletion, not this value, is what makes
      // the account "not a customer".
      role: "customer",
    },
    app_metadata: { is_admin: true },
  });

  if (createError || !created?.user) {
    const message = createError?.message ?? "অ্যাকাউন্ট তৈরি করা যায়নি";
    // Supabase reports a duplicate address as a generic 422; say the useful thing.
    const friendly = /already|exists|registered/i.test(message)
      ? "এই ইমেইলে অ্যাকাউন্ট আগে থেকেই আছে"
      : message;
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  const { error: provisionError } = await ctx.service.rpc("admin_provision_admin", {
    p_actor: ctx.userId,
    p_user_id: created.user.id,
    p_full_name: fullName,
    p_email: email,
    p_level: level,
  });

  if (provisionError) {
    // The login exists but is not an admin and has no profile — an account
    // that can do nothing at all. Roll it back rather than leave that behind.
    await ctx.service.auth.admin.deleteUser(created.user.id);
    const missing = /admin_provision_admin|schema cache|does not exist/i.test(
      provisionError.message,
    );
    return NextResponse.json(
      {
        error: missing
          ? "ডেটাবেস মাইগ্রেশন বাকি আছে — 20260901_admin_identity.sql চালাও"
          : provisionError.message,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}

/**
 * Setting another admin's password.
 *
 * Directly, not by mailing a reset link — for the same reason the account is
 * created with email_confirm: true. Access to the panel must not depend on
 * inbox delivery, and an admin who is locked out is exactly the person whose
 * mail you cannot rely on reaching. A SUPER_ADMIN sets a password, tells them,
 * and they change it themselves afterwards.
 *
 * Only accounts already in admin_users can be targeted, so this cannot be used
 * to take over a customer's or shop owner's login.
 */
export async function PATCH(req: Request) {
  const guard = await requireAdmin("SUPER_ADMIN");
  if ("response" in guard) return guard.response;
  const { ctx } = guard;

  let body: { userId?: string; password?: string };
  try {
    body = (await req.json()) as { userId?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const { userId, password } = body;

  if (!userId) {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে" }, { status: 400 });
  }

  const { data: target } = await ctx.service
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "এই অ্যাকাউন্টটি এডমিন নয়" }, { status: 403 });
  }

  const { error } = await ctx.service.auth.admin.updateUserById(userId, { password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await ctx.service.from("admin_audit_log").insert({
    actor_id: ctx.userId,
    action: "ADMIN_PASSWORD_SET",
    target_type: "admin",
    target_id: userId,
    meta: {},
  });

  return NextResponse.json({ ok: true });
}
