import { createServerSupabase } from "@/lib/supabase/server";
import { CustomerShell } from "./_components/CustomerShell";

/**
 * Whether there is a session is read here, on the server, rather than sniffed
 * in the shell. /explore/[shopId] is reachable without one — it is the URL on
 * every QR poster — and a client-side check would render the signed-in chrome
 * for a moment before correcting itself.
 */
export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <CustomerShell signedIn={!!user}>{children}</CustomerShell>;
}
