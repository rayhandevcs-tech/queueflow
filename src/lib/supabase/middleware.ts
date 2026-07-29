import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { ROLE_HOME } from "@/config/constants";
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
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];
/** Any signed-in role may access these — not gated to a specific role. */
const AUTH_REQUIRED_PREFIXES = ["/account", "/complete-profile"];

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

  const needsProvider = startsWithAny(path, PROVIDER_PREFIXES);
  const needsCustomer = startsWithAny(path, CUSTOMER_PREFIXES);
  const isAuthPage = startsWithAny(path, AUTH_PAGES);
  const needsAuth =
    needsProvider || needsCustomer || startsWithAny(path, AUTH_REQUIRED_PREFIXES);

  // 1) Private area, no session → login (preserving the intended destination)
  if (!user && needsAuth) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // 2) Logged in on an auth page → role home
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = ROLE_HOME[role];
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 3) Wrong role for the group → own home
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