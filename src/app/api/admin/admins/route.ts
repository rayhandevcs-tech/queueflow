import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type { AdminLevel } from "@/types";

/**
 * Creating an admin account.
 *
 * This is a server route rather than a SQL function for one reason: the
 * auth.users row needs a hashed password and a confirmed email, and that is
 * Supabase's Admin API's job — hand-writing into the auth schema is how
 * accounts end up unable to sign in (see the note in /api/admin/account).
 *
 * Authorisation is two-step and never trusts the caller's own claim: the
 * session cookie says who is asking, then admin_users is read with the service
 * role to confirm they are an ACTIVE SUPER_ADMIN. admin_provision_admin()
 * re-checks the same thing in SQL, so neither layer is load-bearing alone.
 *
 * email_confirm: true is deliberate. An admin is vouched for by another admin,
 * not by a confirmation mail — and making the panel's access depend on inbox
 * delivery is exactly the failure this sprint is fixing elsewhere.
 */

const LEVELS: readonly AdminLevel[] = ["SUPER_ADMIN", "MODERATOR", "SUPPORT"];

interface Body {
  fullName?: string;
  email?: string;
  password?: string;
  level?: AdminLevel;
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

  const { data: actor } = await admin
    .from("admin_users")
    .select("user_id, level, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!actor || actor.level !== "SUPER_ADMIN" || actor.status !== "ACTIVE") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

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

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // No `role` key: the signup trigger reads that to decide customer vs
    // provider, and this account is neither. Whatever profile row the trigger
    // still creates is removed by admin_provision_admin() below.
    user_metadata: { full_name: fullName, is_admin_account: true },
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

  const { error: provisionError } = await admin.rpc("admin_provision_admin", {
    p_actor: user.id,
    p_user_id: created.user.id,
    p_full_name: fullName,
    p_email: email,
    p_level: level,
  });

  if (provisionError) {
    // The login exists but is not an admin and has no profile — an account
    // that can do nothing at all. Roll it back rather than leave that behind.
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: provisionError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
