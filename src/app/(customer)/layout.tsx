import Link from "next/link";
import { Compass, LogIn, Ticket, UserRound } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/Logo";
import { NavLink } from "@/components/ui/NavLink";
import { Button } from "@/components/ui/Button";

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <Link href="/explore">
            <Logo />
          </Link>
          <nav className="flex gap-1 overflow-x-auto">
            <NavLink href="/explore">
              <Compass className="h-4 w-4" />
              Explore
            </NavLink>
            <NavLink href="/my-serial">
              <Ticket className="h-4 w-4" />
              My Serial
            </NavLink>
          </nav>
          <div className="ml-auto">
            {user ? (
              <NavLink href="/account">
                <UserRound className="h-4 w-4" />
                Account
              </NavLink>
            ) : (
              <Link href="/login">
                <Button size="sm">
                  <LogIn className="h-3.5 w-3.5" />
                  Log in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
