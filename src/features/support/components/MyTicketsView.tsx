"use client";

import Link from "next/link";
import { ChevronRight, LifeBuoy, MessageSquarePlus } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { SupportStatusBadge } from "@/components/ui/SupportStatusBadge";
import { SUPPORT_CATEGORY_LABEL } from "@/config/constants";
import { dayLabel } from "@/lib/date-groups";
import { toBanglaDigits } from "@/lib/format-wait";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useMyTickets } from "../hooks/use-tickets";
import { supportDict } from "../lib/i18n";

function TicketListSkeleton() {
  return (
    <div className="space-y-2.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-3xl border border-line bg-card p-4 shadow-sm">
          <Skeleton className="h-3.5 w-2/5 rounded-full" />
          <Skeleton className="mt-2.5 h-3 w-4/5 rounded-full" />
          <Skeleton className="mt-3 h-3 w-1/4 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function MyTicketsView() {
  const t = useT(supportDict);
  const categoryT = useT(SUPPORT_CATEGORY_LABEL);
  const { data: tickets, isPending } = useMyTickets();

  if (isPending) return <TicketListSkeleton />;

  if (!tickets || tickets.length === 0) {
    return (
      <EmptyState
        icon={<LifeBuoy className="h-6 w-6" />}
        title={t("noTicketsTitle")}
        description={t("noTicketsDesc")}
        action={
          <Link
            href="/help/new"
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-[14px] bg-accent px-5 text-sm font-semibold text-accent-ink",
              "shadow-sm transition-shadow hover:shadow-glow active:shadow-xs",
              "focus-visible:ring-4 focus-visible:ring-accent/35 focus-visible:outline-none",
            )}
          >
            <MessageSquarePlus className="h-4 w-4" />
            {t("newTicket")}
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <Link
        href="/help/new"
        className={cn(
          "flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-dashed border-line",
          "text-sm font-semibold text-muted transition-colors",
          "hover:border-accent/50 hover:bg-accent/[0.04] hover:text-accent",
        )}
      >
        <MessageSquarePlus className="h-4 w-4" />
        {t("newTicket")}
      </Link>

      {tickets.map((ticket) => (
        <Link
          key={ticket.id}
          href={`/help/tickets/${ticket.id}`}
          className={cn(
            "block rounded-3xl border border-line bg-card p-4 shadow-sm",
            "transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md",
            "focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none",
          )}
        >
          <div className="flex items-start gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <SupportStatusBadge status={ticket.status} />
                <span className="text-[11px] font-semibold text-muted">
                  {categoryT(ticket.category)}
                </span>
                {ticket.has_unread && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-ink">
                    {t("unreadReply")}
                  </span>
                )}
              </div>
              <p className="mt-2 truncate font-display text-[15px] font-bold text-ink">
                {ticket.subject}
              </p>
              {ticket.last_preview && (
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">
                  {ticket.last_preview}
                </p>
              )}
            </div>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted" />
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5 text-[11px] text-muted">
            <span>
              {t("openedOn")} {dayLabel(ticket.created_at)}
            </span>
            <span aria-hidden>·</span>
            <span className="font-number">{toBanglaDigits(ticket.message_count)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
