import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { ADMIN_HOME, ROLE_HOME } from "@/config/constants";
import type { UserRole } from "@/types";

export default async function HomePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No session → the login screen. This used to drop people straight into
  // /explore, which read as a signed-in app: the sidebar showed a profile, a
  // notification bell and a log-out button to someone who had never signed in.
  // The one public entry point is /explore/[shopId], reached from a shop's QR
  // poster — that one is deliberate, and middleware still lets it through.
  if (!user) redirect("/login");

  if (user.app_metadata?.is_admin === true) redirect(ADMIN_HOME);

  const role: UserRole = (user.user_metadata?.role as UserRole | undefined) ?? "customer";
  redirect(ROLE_HOME[role]);
}
