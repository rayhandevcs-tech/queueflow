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
  // The AI assistant reads the caller's own shop and spends real money doing
  // it, so it is provider-only for both reasons at once.
  "/ai",
  // The shop's money pages. RLS already returns nothing to a non-owner, so
  // these were never a leak — but landing on an empty ledger reads like a bug,
  // and being sent home reads like an answer.
  "/cashbook",
  "/due-ledger",
  "/manual-entries",
  "/analytics",
  "/regulars",
  "/reviews",
];
const CUSTOMER_PREFIXES = ["/my-serial", "/history", "/profile", "/chats", "/transactions", "/style"];
/**
 * Customer pages that are one exact path, because a child of theirs belongs to
 * someone else: /notifications is the customer's inbox, while
 * /notifications/send is the provider's broadcast screen.
 */
const CUSTOMER_EXACT = ["/notifications"];
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
  // Browsing the catalogue needs no account (Sprint 38): `/`, `/about`,
  // `/explore` and `/explore/[shopId]` are all open. Authentication is decided
  // per ACTION now, not per page — the login dialog appears when someone tries
  // to book, favourite or message, and until then there is nothing to protect.
  //
  // What stays gated is everything that IS an account: serials, chats,
  // transactions, the profile, the notification inbox. /explore/[shopId]/chat
  // is in that group even though its parent is public — you cannot message a
  // shop as nobody.
  const isChatUnderExplore = /^\/explore\/[^/]+\/chat/.test(path);
  const needsCustomer =
    startsWithAny(path, CUSTOMER_PREFIXES) ||
    CUSTOMER_EXACT.includes(path) ||
    isChatUnderExplore;
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
  //
  // Only the admin door sends anyone to the panel. Routing on the is_admin
  // claim alone was wrong in both directions: the claim outlives the
  // membership that granted it, so a shop owner who was ever seeded as an
  // admin was redirected into the panel every time they signed in, and could
  // never reach their own dashboard again. The claim is now used for one thing
  // only — denying /admin in rule 3 — and never to take an app away from
  // someone.
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = isAdminLogin && isAdmin ? ADMIN_HOME : ROLE_HOME[role];
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

  // (Sprint 37) A rule bouncing every is_admin account out of the customer and
  // provider apps used to sit here. It was cosmetic — an admin has no profile,
  // so those screens would look empty — and its failure mode was not: any
  // account carrying a stale is_admin claim was thrown out of its own
  // dashboard on every single request, with no way back short of editing the
  // database. An empty screen is a much smaller problem than a locked door.

  // 4) Wrong role for the group → own home.
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