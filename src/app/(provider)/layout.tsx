import { ProviderShell } from "./_components/ProviderShell";

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProviderShell>{children}</ProviderShell>;
}
