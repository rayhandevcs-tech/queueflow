import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { ADMIN_HOME, ADMIN_LOGIN, ROLE_HOME } from "@/config/constants";
import type { UserRole } from "@/types";

const PROVIDER_PREFIXES = [
  "/dashboard",
  "/services",
  "/chairs",
  "/summary",
  "/settings",
  "/income",
  "/analytics",
  "/regulars",
  "/reviews",
];
const CUSTOMER_PREFIXES = ["/my-serial", "/history", "/profile"];
const ADMIN_PREFIXES = ["/admin"];
const AUTH_PAGES = [
  "/login",
  "/register",
  "/forgot-password",
  "/verify-email",
  ADMIN_LOGIN,
];
/** Any signed-in role may access these — not gated to a specific role. */
const AUTH_REQUIRED_PREFIXES = [
  "/account",
  "/complete-profile",
  "/help",
  "/privacy",
  "/terms",
  "/cancellation-policy",
  "/notification-settings",
];

function startsWithAny(path: string, prefixes: string[]) {
  return prefixes.some((p) => path === p || path.startsWith(p + "/"));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the session (do not remove — required by @supabase/ssr)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const role: UserRole =
    (user?.user_metadata?.role as UserRole | undefined) ?? "customer";
  // Deliberately app_metadata: user_metadata is writable by the user via
  // auth.updateUser(), so reading the admin flag from there would let anyone
  // walk into /admin. This claim only gates the UI shell — every admin query
  // and RPC re-checks membership in admin_users through RLS.
  const isAdmin = user?.app_metadata?.is_admin === true;

  const isAdminLogin = path === ADMIN_LOGIN;
  const needsProvider = startsWithAny(path, PROVIDER_PREFIXES);
  const needsCustomer = startsWithAny(path, CUSTOMER_PREFIXES);
  // /admin/login is under /admin but must be reachable without a session —
  // it is where you go to *get* one.
  const needsAdmin = startsWithAny(path, ADMIN_PREFIXES) && !isAdminLogin;
  const isAuthPage = startsWithAny(path, AUTH_PAGES);
  const needsAuth =
    needsProvider ||
    needsCustomer ||
    needsAdmin ||
    startsWithAny(path, AUTH_REQUIRED_PREFIXES);

  // 1) Private area, no session → the matching login. The panel has its own
  // door since Sprint 36, so an expired admin session goes back to that one
  // rather than to the customer login it can't use.
  if (!user && needsAuth) {
    const url = request.nextUrl.clone();
    url.pathname = needsAdmin ? ADMIN_LOGIN : "/login";
    url.search = "";
    if (!needsAdmin) url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // 2) Logged in on an auth page → wherever this identity belongs.
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = isAdmin ? ADMIN_HOME : ROLE_HOME[role];
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 3) Not an admin under /admin → own home. No 403 page and no hint that the
  // panel exists; a signed-in non-admin just gets bounced to their own app.
  if (user && needsAdmin && !isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = ROLE_HOME[role];
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 4) An admin anywhere in the customer or provider app → back to the panel.
  //
  // This is the routing half of "an admin is not a customer and not a shop
  // owner": the account has no profile row, so those screens would render
  // empty or half-broken. Sending it home is kinder than showing it a
  // dashboard with nothing in it.
  if (user && isAdmin && (needsProvider || needsCustomer)) {
    const url = request.nextUrl.clone();
    url.pathname = ADMIN_HOME;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 5) Wrong role for the group → own home.
  if (user && needsProvider && role !== "provider") {
    const url = request.nextUrl.clone();
    url.pathname = ROLE_HOME.customer;
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && needsCustomer && role !== "customer") {
    const url = request.nextUrl.clone();
    url.pathname = ROLE_HOME.provider;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}