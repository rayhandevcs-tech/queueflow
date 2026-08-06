import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getServiceRoleClient, SERVICE_ROLE_MISSING } from "@/lib/supabase/service-role";

/**
 * "সেটিংস → অ্যাকাউন্ট মুছে ফেলো" — the self-serve deletion.
 *
 * It moved out of a pure RPC because SQL cannot free the email address. A
 * plain `delete from auth.users` removes the user row but leaves the
 * auth.identities row that password sign-in resolves against, so the address
 * stays claimed forever and the person can never register again. Only the
 * Admin API removes the account the way GoTrue expects — and that needs the
 * service-role key, which cannot leave the server.
 *
 * delete_my_account() still runs first and still owns the rule (a shop owner
 * must go through support). It only checks now; if the deletion below fails,
 * the account is left exactly as it was.
 */
export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error: checkError } = await supabase.rpc("delete_my_account");
  if (checkError) {
    return NextResponse.json({ error: checkError.message }, { status: 400 });
  }

  let service;
  try {
    service = getServiceRoleClient();
  } catch (error) {
    const missing = error instanceof Error && error.message === SERVICE_ROLE_MISSING;
    return NextResponse.json(
      { error: missing ? "সার্ভার কনফিগারেশন অসম্পূর্ণ" : "সার্ভারে সমস্যা" },
      { status: 500 },
    );
  }

  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
