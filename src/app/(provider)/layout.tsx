import { ProviderSidebar } from "./_components/ProviderSidebar";

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <ProviderSidebar />
      <main className="min-w-0 flex-1 overflow-x-hidden px-6 py-7 sm:px-8.5">{children}</main>
    </div>
  );
}
