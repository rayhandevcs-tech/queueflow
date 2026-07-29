import Link from "next/link";
import { site } from "@/config/site";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-accent px-12 py-14 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-brass/20 blur-3xl" />

        <span className="relative font-display text-lg font-bold text-accent-ink">
          {site.name}
        </span>

        <div className="relative space-y-4">
          <p className="max-w-sm font-display text-3xl font-bold leading-tight text-accent-ink">
            {site.tagline}
          </p>
          <p className="max-w-xs text-sm text-accent-ink/55">
            আশেপাশের সেলুন ও পার্লারের লাইভ সিরিয়াল দেখুন, বাসা থেকেই বুক করুন —
            ম্যাপ, সিরিয়াল নম্বর, এস্টিমেটেড টাইম, সব এক জায়গায়।
          </p>
        </div>

        <p className="relative text-xs text-accent-ink/35">
          &copy; {site.name}
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center lg:text-left">
            <Link
              href="/"
              className="font-display text-lg font-bold text-ink lg:hidden"
            >
              {site.name}
            </Link>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink lg:mt-0">
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
