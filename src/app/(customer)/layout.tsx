import { CustomerBottomNav } from "./_components/CustomerBottomNav";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-md px-4 pt-6 pb-28">{children}</main>
      <CustomerBottomNav />
    </div>
  );
}
