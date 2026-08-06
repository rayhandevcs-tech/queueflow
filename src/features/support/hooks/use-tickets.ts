"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import {
  createTicket,
  getMyTicket,
  listMyTickets,
  listTicketMessages,
  markTicketRead,
  replyToMyTicket,
} from "../api/tickets.api";

export type { MyTicketRow, TicketMessage } from "../api/tickets.api";

export function useMyTickets() {
  return useQuery({ queryKey: keys.support.myTickets(), queryFn: listMyTickets });
}

export function useMyTicket(ticketId: string | undefined) {
  return useQuery({
    queryKey: keys.support.ticket(ticketId ?? ""),
    queryFn: () => getMyTicket(ticketId!),
    enabled: !!ticketId,
  });
}

export function useTicketMessages(ticketId: string | undefined) {
  return useQuery({
    queryKey: keys.support.messages(ticketId ?? ""),
    queryFn: () => listTicketMessages(ticketId!),
    enabled: !!ticketId,
    // Support replies arrive out of band. A slow poll keeps an open thread
    // honest without paying for a realtime channel on a screen most people
    // visit once.
    refetchInterval: 30_000,
  });
}

export function useTicketMutations(ticketId?: string) {
  const queryClient = useQueryClient();

  const invalidateList = () => {
    void queryClient.invalidateQueries({ queryKey: keys.support.myTickets() });
  };

  const create = useMutation({ mutationFn: createTicket, onSuccess: invalidateList });

  const reply = useMutation({
    mutationFn: replyToMyTicket,
    onSuccess: () => {
      invalidateList();
      if (ticketId) {
        void queryClient.invalidateQueries({ queryKey: keys.support.messages(ticketId) });
        void queryClient.invalidateQueries({ queryKey: keys.support.ticket(ticketId) });
      }
    },
  });

  const markRead = useMutation({ mutationFn: markTicketRead, onSuccess: invalidateList });

  return { create, reply, markRead };
}
