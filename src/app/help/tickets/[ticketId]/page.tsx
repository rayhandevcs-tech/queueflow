import { TicketPageShell } from "./TicketPageShell";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  return <TicketPageShell ticketId={ticketId} />;
}
