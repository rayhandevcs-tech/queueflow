import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ADMIN_HOME } from "@/config/constants";

/**
 * Where every link in a Supabase auth email lands.
 *
 * THIS ROUTE DID NOT EXIST BEFORE SPRINT 36, AND THAT WAS THE BUG.
 *
 * The browser client is created with @supabase/ssr's createBrowserClient,
 * which uses the PKCE flow. Under PKCE a confirmation link does not carry a
 * session — it carries a one-time `code` that has to be exchanged for one,
 * server-side, against a verifier stored in the user's cookies. With no route
 * doing that exchange, clicking "confirm your email" dropped the person on the
 * site root with an unused `?code=` in the address bar and no session: the
 * account stayed unconfirmed, and the next login attempt failed with
 * "email not confirmed".
 *
 * Two link shapes are handled, because Supabase's templates use both:
 *
 *   ?code=…                  — PKCE, from {{ .ConfirmationURL }}
 *   ?token_hash=…&type=…     — from {{ .TokenHash }}, the newer template style
 *
 * The 6-digit code path (verify-email) is unaffected: that one never leaves
 * the browser, and it keeps working exactly as before. This route is the
 * second door, for people who click the link in the mail instead of typing the
 * code — which is what most people do.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next");

  const supabase = await createServerSupabase();

  let failed: string | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) failed = error.message;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "signup" | "recovery" | "invite" | "email_change" | "magiclink",
      token_hash: tokenHash,
    });
    if (error) failed = error.message;
  } else {
    failed = "missing_code";
  }

  if (failed) {
    // Don't leak the raw Supabase message into the address bar; the login
    // screen already knows how to say "that link is wrong or expired".
    const bounce = new URL("/login", url.origin);
    bounce.searchParams.set("error", "link_invalid");
    return NextResponse.redirect(bounce);
  }

  // A recovery link has to land on the password form, not on the app: the
  // session it just created exists only so the user can set a new password.
  const destination = new URL("/", url.origin);

  if (next?.startsWith("/")) {
    destination.pathname = next;
    return NextResponse.redirect(destination);
  }

  if (type === "recovery") {
    destination.pathname = "/reset-password";
    return NextResponse.redirect(destination);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.app_metadata?.is_admin === true) {
    destination.pathname = ADMIN_HOME;
    return NextResponse.redirect(destination);
  }

  // Confirming an email is the first thing a new account does, and its profile
  // is still empty at that point — complete-profile forwards to the right home
  // once it's filled in, and passes straight through for an account that
  // already has one.
  destination.pathname = "/complete-profile";
  return NextResponse.redirect(destination);
}
