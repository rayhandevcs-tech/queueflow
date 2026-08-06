import { createServerSupabase } from "@/lib/supabase/server";
import { AuthGateProvider } from "@/components/auth/AuthGate";
import { CustomerShell } from "./_components/CustomerShell";

/**
 * Whether there is a session is read here, on the server, and handed down.
 *
 * Everything below — which chrome renders, and whether an action runs or opens
 * the login dialog — reads it from that one value, so the first paint is
 * already right. A client-side session check would render the signed-in shell
 * for a beat before correcting itself, and hydrate differently than it
 * rendered.
 *
 * This does NOT decide who may see what: middleware still guards every private
 * route, and RLS still guards every row. It only decides what the page looks
 * like.
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

  const signedIn = !!user;

  return (
    <AuthGateProvider signedIn={signedIn}>
      <CustomerShell signedIn={signedIn}>{children}</CustomerShell>
    </AuthGateProvider>
  );
}
