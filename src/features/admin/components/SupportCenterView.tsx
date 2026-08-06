"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  Headset,
  Inbox,
  Lock,
  Search,
  Send,
  StickyNote,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Textarea } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { SupportStatusBadge } from "@/components/ui/SupportStatusBadge";
import {
  ROLE_LABEL,
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABEL,
} from "@/config/constants";
import { dayLabel } from "@/lib/date-groups";
import { formatBanglaTime } from "@/lib/format-wait";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { SupportStatus } from "@/types";
import {
  useAdminTicketMessages,
  useAdminTicketMutations,
  useAdminTickets,
} from "../hooks/use-admin";
import type { AdminTicketRow } from "../api/admin.api";
import { adminDict } from "../lib/i18n";

// ---------------------------------------------------------------------------
// The thread
// ---------------------------------------------------------------------------

function TicketThread({ ticket, onBack }: { ticket: AdminTicketRow; onBack: () => void }) {
  const t = useT(adminDict);
  const categoryT = useT(SUPPORT_CATEGORY_LABEL);
  const roleT = useT(ROLE_LABEL);
  const statusT = useT(SUPPORT_STATUS_LABEL);
  const { data: messages, isPending } = useAdminTicketMessages(ticket.id);
  const { reply, changeStatus, markRead } = useAdminTicketMutations(ticket.id);

  const [draft, setDraft] = useState("");
  const [internal, setInternal] = useState(false);

  // Opening a ticket is what clears the "needs attention" mark for staff.
  // The draft doesn't need clearing here — the parent keys this component on
  // the ticket id, so switching tickets remounts it with fresh state.
  const markReadMutate = markRead.mutate;
  useEffect(() => {
    markReadMutate(ticket.id);
  }, [ticket.id, markReadMutate]);

  const send = () => {
    const body = draft.trim();
    if (!body || reply.isPending) return;
    reply.mutate(
      { ticketId: ticket.id, body, internal },
      { onSuccess: () => setDraft("") },
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 space-y-2 border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Below md the list and the thread share the same space, so the
              thread needs its own way back to the list. */}
          <button
            type="button"
            onClick={onBack}
            aria-label={t("backToTickets")}
            className="-ml-2 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-soft hover:text-ink md:hidden"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <SupportStatusBadge status={ticket.status} />
          <span className="text-[11px] font-semibold text-muted">
            {categoryT(ticket.category)}
          </span>
        </div>
        <h2 className="font-display text-lg leading-snug font-bold text-ink">
          {ticket.subject}
        </h2>
        <p className="text-[12px] text-muted">
          {t("ticketFrom")}: <span className="font-semibold text-ink">{ticket.user_name ?? "—"}</span>
          {ticket.user_email ? ` · ${ticket.user_email}` : ""}
          {ticket.user_role ? ` · ${roleT(ticket.user_role)}` : ""}
        </p>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-muted">{t("changeStatusLabel")}:</span>
          {SUPPORT_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => changeStatus.mutate({ id: ticket.id, status })}
              disabled={changeStatus.isPending || status === ticket.status}
              className={cn(
                "min-h-9 rounded-full border px-3 text-[12px] font-semibold transition-colors",
                "focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none",
                status === ticket.status
                  ? "border-accent bg-accent/[0.09] text-accent"
                  : "border-line bg-soft text-muted hover:bg-card hover:text-ink",
              )}
            >
              {statusT(status)}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {isPending ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-3xl" />)
        ) : (
          messages?.map((message) => (
            <div
              key={message.id}
              className={cn(
                "rounded-3xl border p-3.5 shadow-xs",
                message.is_internal
                  ? // A note is a different kind of object from a reply, so it
                    // gets a different material: dashed, unfilled, unmistakable.
                    "border-dashed border-brass/40 bg-brass-soft/40"
                  : message.is_staff
                    ? "border-accent/20 bg-gradient-to-br from-accent/[0.07] to-accent/[0.02]"
                    : "border-line bg-card",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                    message.is_internal
                      ? "bg-brass/15 text-brass"
                      : message.is_staff
                        ? "bg-accent/12 text-accent"
                        : "bg-soft text-muted",
                  )}
                >
                  {message.is_internal ? (
                    <StickyNote className="h-3.5 w-3.5" />
                  ) : message.is_staff ? (
                    <Headset className="h-3.5 w-3.5" />
                  ) : (
                    <UserRound className="h-3.5 w-3.5" />
                  )}
                </span>
                <p className="text-[13px] font-bold text-ink">
                  {message.is_staff ? t("staffLabel") : (ticket.user_name ?? "—")}
                </p>
                {message.is_internal && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brass/15 px-2 py-0.5 text-[10px] font-bold text-brass">
                    <Lock className="h-2.5 w-2.5" />
                    {t("internalNoteBadge")}
                  </span>
                )}
                <span className="ml-auto font-number text-[11px] text-muted">
                  {dayLabel(message.created_at)} · {formatBanglaTime(new Date(message.created_at))}
                </span>
              </div>

              <p className="mt-2 text-[14px] leading-relaxed whitespace-pre-wrap text-ink">
                {message.body}
              </p>

              {message.images.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {message.images.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="h-20 w-20 overflow-hidden rounded-[14px] border border-line bg-soft transition-transform hover:scale-[1.03]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="shrink-0 space-y-2.5 border-t border-line px-5 py-4">
        {/* One composer, two destinations. A separate "notes" panel would let
            an admin lose track of which box they were typing in — the toggle
            makes the destination part of the message being written. */}
        <div className="flex items-center gap-1.5">
          {[false, true].map((value) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setInternal(value)}
              aria-pressed={internal === value}
              className={cn(
                "min-h-9 rounded-full px-3.5 text-[12px] font-semibold transition-colors",
                internal === value
                  ? value
                    ? "bg-brass/15 text-brass"
                    : "bg-accent/10 text-accent"
                  : "text-muted hover:bg-soft",
              )}
            >
              {value ? t("internalNoteLabel") : t("replyLabel")}
            </button>
          ))}
        </div>

        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={internal ? t("internalNotePlaceholder") : t("replyPlaceholder")}
          rows={3}
          maxLength={2000}
        />

        <Button
          onClick={send}
          loading={reply.isPending}
          disabled={!draft.trim()}
          className="w-full"
        >
          {internal ? <StickyNote className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {internal ? t("saveNote") : t("sendReply")}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The list + shell
// ---------------------------------------------------------------------------

export function SupportCenterView() {
  const t = useT(adminDict);
  const categoryT = useT(SUPPORT_CATEGORY_LABEL);
  const statusT = useT(SUPPORT_STATUS_LABEL);

  const [status, setStatus] = useState<SupportStatus | null>("PENDING");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isPending } = useAdminTickets(status, search);
  const rows = data?.rows ?? [];
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <PageHeader title={t("supportTitle")} description={t("supportSubtitle")} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStatus(null)}
          className={cn(
            "min-h-11 rounded-full border px-4 text-[13px] font-semibold transition-colors",
            status === null
              ? "border-accent bg-accent/[0.09] text-accent"
              : "border-line bg-soft text-muted hover:bg-card hover:text-ink",
          )}
        >
          {t("allTickets")}
        </button>
        {SUPPORT_STATUSES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-[13px] font-semibold transition-colors",
              status === value
                ? "border-accent bg-accent/[0.09] text-accent"
                : "border-line bg-soft text-muted hover:bg-card hover:text-ink",
            )}
          >
            {statusT(value)}
          </button>
        ))}
      </div>

      <Input
        icon={<Search className="h-4 w-4" />}
        placeholder={t("ticketSearchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex h-[calc(100dvh-19rem)] min-h-125 overflow-hidden rounded-3xl border border-line bg-card shadow-sm">
        <div
          className={cn(
            "h-full min-h-0 flex-col overflow-y-auto border-line p-2.5 md:flex md:w-[22rem] md:shrink-0 md:border-r",
            selected ? "hidden" : "flex w-full",
          )}
        >
          {isPending ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              dashed
              className="mt-2"
              icon={<Inbox className="h-6 w-6" />}
              title={t("noTicketsTitle")}
              description={t("noTicketsDesc")}
            />
          ) : (
            <div className="flex flex-col gap-1">
              {rows.map((row) => {
                const active = row.id === selectedId;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={cn(
                      "relative rounded-2xl px-3.5 py-3 text-left transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none",
                      active ? "bg-accent/[0.07] shadow-xs" : "hover:bg-soft",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-1/2 left-0 w-[3px] -translate-y-1/2 rounded-r-full bg-accent transition-all duration-200",
                        active ? "h-7 opacity-100" : "h-0 opacity-0",
                      )}
                    />
                    <div className="flex items-center gap-2">
                      <SupportStatusBadge status={row.status} />
                      {row.needs_reply && (
                        <span className="rounded-full bg-live px-2 py-0.5 text-[10px] font-bold text-white">
                          {t("needsReply")}
                        </span>
                      )}
                      <span className="ml-auto shrink-0 text-[11px] text-muted">
                        {dayLabel(row.last_message_at)}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-[14px] font-bold text-ink">{row.subject}</p>
                    <p className="mt-0.5 truncate text-[12px] text-muted">
                      {row.user_name ?? "—"} · {categoryT(row.category)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div
          className={cn(
            "h-full min-h-0 flex-1 flex-col overflow-hidden bg-paper",
            selected ? "flex w-full" : "hidden md:flex",
          )}
        >
          {selected ? (
            <TicketThread key={selected.id} ticket={selected} onBack={() => setSelectedId(null)} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
              <div className="grid h-20 w-20 place-items-center rounded-full bg-accent/[0.06] ring-1 ring-accent/10">
                <div className="grid h-13 w-13 place-items-center rounded-full bg-card text-accent shadow-sm ring-1 ring-accent/15">
                  <Headset className="h-6 w-6" />
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="font-display text-lg font-bold text-ink">{t("selectTicketTitle")}</p>
                <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-muted">
                  {t("selectTicketDesc")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
