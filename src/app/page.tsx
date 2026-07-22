import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { ROLE_HOME } from "@/config/constants";
import type { UserRole } from "@/types";

export default async function HomePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/explore");

  const role: UserRole = (user.user_metadata?.role as UserRole | undefined) ?? "customer";
  redirect(ROLE_HOME[role]);
}
