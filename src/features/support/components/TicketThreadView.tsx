"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Headset, Send, UserRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { SupportStatusBadge } from "@/components/ui/SupportStatusBadge";
import { Textarea } from "@/components/ui/Input";
import { SUPPORT_CATEGORY_LABEL } from "@/config/constants";
import { dayLabel } from "@/lib/date-groups";
import { formatBanglaTime } from "@/lib/format-wait";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useMyTicket, useTicketMessages, useTicketMutations } from "../hooks/use-tickets";
import { TicketImageStrip } from "./TicketImageStrip";
import { supportDict } from "../lib/i18n";

function ThreadSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className={cn("h-20 rounded-3xl", i % 2 ? "ml-8" : "mr-8")} />
      ))}
    </div>
  );
}

export function TicketThreadView({ ticketId }: { ticketId: string }) {
  const t = useT(supportDict);
  const categoryT = useT(SUPPORT_CATEGORY_LABEL);
  const { data: ticket, isPending: ticketPending } = useMyTicket(ticketId);
  const { data: messages, isPending: messagesPending } = useTicketMessages(ticketId);
  const { reply, markRead } = useTicketMutations(ticketId);
  const [draft, setDraft] = useState("");

  // Opening the thread is what clears the "new reply" mark on the list. Fires
  // once per ticket, not on every poll, so a thread left open doesn't keep
  // writing to the row.
  const markReadMutate = markRead.mutate;
  useEffect(() => {
    markReadMutate(ticketId);
  }, [ticketId, markReadMutate]);

  if (ticketPending) return <ThreadSkeleton />;

  if (!ticket) {
    return <EmptyState icon={<Headset className="h-6 w-6" />} title={t("ticketNotFound")} />;
  }

  const closed = ticket.status === "CLOSED";

  const onSend = () => {
    const body = draft.trim();
    if (!body || reply.isPending) return;
    reply.mutate({ ticketId, body }, { onSuccess: () => setDraft("") });
  };

  return (
    <div className="space-y-4">
      <Link
        href="/help"
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted transition-colors hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("supportTitle")}
      </Link>

      <Card tone="soft" className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SupportStatusBadge status={ticket.status} />
          <span className="text-[11px] font-semibold text-muted">
            {categoryT(ticket.category)}
          </span>
        </div>
        <h2 className="font-display text-lg leading-snug font-bold text-ink">{ticket.subject}</h2>
        <p className="text-[11px] text-muted">
          {t("openedOn")} {dayLabel(ticket.created_at)}
        </p>
      </Card>

      {messagesPending ? (
        <ThreadSkeleton />
      ) : (
        <div className="space-y-3">
          {messages?.map((message) => {
            const staff = message.is_staff;
            return (
              <div
                key={message.id}
                className={cn(
                  "rounded-3xl border p-3.5 shadow-xs",
                  // Staff replies are the ones being waited on, so they get the
                  // brand wash; the customer's own messages stay quiet paper.
                  staff
                    ? "border-accent/20 bg-gradient-to-br from-accent/[0.07] to-accent/[0.02]"
                    : "border-line bg-card",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                      staff ? "bg-accent/12 text-accent" : "bg-soft text-muted",
                    )}
                  >
                    {staff ? <Headset className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                  </span>
                  <p className="text-[13px] font-bold text-ink">
                    {staff ? t("supportTeamLabel") : t("youLabel")}
                  </p>
                  <span className="ml-auto font-number text-[11px] text-muted">
                    {formatBanglaTime(new Date(message.created_at))}
                  </span>
                </div>

                <p className="mt-2 text-[14px] leading-relaxed whitespace-pre-wrap text-ink">
                  {message.body}
                </p>
                <TicketImageStrip urls={message.images} />
              </div>
            );
          })}
        </div>
      )}

      {closed ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-3.5 text-center text-[13px] text-muted">
          {t("closedNotice")}
        </p>
      ) : (
        <div className="space-y-2.5">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("replyPlaceholder")}
            rows={3}
            maxLength={2000}
          />
          <button
            type="button"
            onClick={onSend}
            disabled={!draft.trim() || reply.isPending}
            className={cn(
              "flex h-11 w-full items-center justify-center gap-2 rounded-[14px]",
              "bg-accent text-sm font-semibold text-accent-ink shadow-sm",
              "transition-shadow hover:shadow-glow active:shadow-xs",
              "focus-visible:ring-4 focus-visible:ring-accent/35 focus-visible:outline-none",
              "disabled:opacity-45 disabled:shadow-none",
            )}
          >
            {reply.isPending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t("sendReply")}
          </button>
        </div>
      )}
    </div>
  );
}
