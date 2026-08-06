import { getBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import type { SupportCategory } from "@/types";

export type MyTicketRow =
  Database["public"]["Functions"]["my_support_tickets"]["Returns"][number];

export type TicketMessage =
  Database["public"]["Tables"]["support_ticket_messages"]["Row"];

export async function listMyTickets(): Promise<MyTicketRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("my_support_tickets");
  if (error) throw error;
  return data ?? [];
}

/**
 * The thread's messages, read straight from the table rather than through an
 * RPC. RLS is what makes that safe *and* correct: the "own read" policy admits
 * only this user's tickets and only rows with is_internal = false, so an admin
 * note can't reach this query even if it wanted to.
 */
export async function listTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getMyTicket(ticketId: string) {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTicket(input: {
  category: SupportCategory;
  subject: string;
  body: string;
  images?: string[];
}): Promise<string> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("create_support_ticket", {
    p_category: input.category,
    p_subject: input.subject.trim(),
    p_body: input.body.trim(),
    p_images: input.images ?? [],
  });
  if (error) throw error;
  return data as string;
}

export async function replyToMyTicket(input: {
  ticketId: string;
  body: string;
  images?: string[];
}): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.rpc("add_support_message", {
    p_ticket_id: input.ticketId,
    p_body: input.body.trim(),
    p_images: input.images ?? [],
  });
  if (error) throw error;
}

export async function markTicketRead(ticketId: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.rpc("mark_support_ticket_read", {
    p_ticket_id: ticketId,
  });
  if (error) throw error;
}
