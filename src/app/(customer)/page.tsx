import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { ADMIN_HOME, ROLE_HOME } from "@/config/constants";
import type { UserRole } from "@/types";
import { ExploreScreen } from "./_components/ExploreScreen";

/**
 * The front door.
 *
 * For a visitor with no account this IS the product — the shop list, the map,
 * ratings, live queues, the lot — rendered here rather than redirected to,
 * because the first thing a stranger sees should not be a login form and
 * should not cost them a round trip. It lives inside the (customer) group so
 * the layout's guest chrome and auth gate wrap it automatically.
 *
 * Someone already signed in is sent to whichever app is theirs. That redirect
 * only ever happens for an account that exists, so nobody pays for it on a
 * first visit.
 */
export default async function HomePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.app_metadata?.is_admin === true) redirect(ADMIN_HOME);

  if (user) {
    const role: UserRole = (user.user_metadata?.role as UserRole | undefined) ?? "customer";
    redirect(ROLE_HOME[role]);
  }

  return <ExploreScreen />;
}
