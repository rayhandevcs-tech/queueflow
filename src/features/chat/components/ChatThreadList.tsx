"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CheckCheck, MessageCircle, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toBanglaDigits } from "@/lib/format-wait";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getStoredLanguage, translate, useT } from "@/lib/i18n";
import { getMessageImageUrls } from "../lib/message-images";
import type { ChatThreadSummary } from "../hooks/use-chat-threads";
import { chatDict } from "../lib/i18n";

function previewText(thread: ChatThreadSummary): string {
  if (getMessageImageUrls(thread.lastMessage).length > 0) return translate(chatDict, "photoPreview");
  return thread.lastMessage.content ?? "";
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const lang = getStoredLanguage();
  if (lang === "en") {
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  }
  if (d.toDateString() === today.toDateString()) {
    const hh = toBanglaDigits(d.getHours()).padStart(2, "০");
    const mm = toBanglaDigits(d.getMinutes()).padStart(2, "০");
    return `${hh}:${mm}`;
  }
  return toBanglaDigits(d.getDate()) + " " + d.toLocaleDateString("bn-BD", { month: "short" });
}

/** Rows that mirror the real list-item geometry, so nothing shifts on load. */
function ThreadListSkeleton() {
  return (
    <div className="flex flex-col gap-1" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 px-2.5 py-3">
          <Skeleton className="h-13 w-13 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5 rounded-full" />
            <Skeleton className="h-3 w-4/5 rounded-full" />
          </div>
          <Skeleton className="h-2.5 w-8 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function ChatThreadList({
  threads,
  isPending,
  hrefFor,
  title,
  myId,
  activeKey,
}: {
  threads: ChatThreadSummary[];
  isPending: boolean;
  hrefFor: (key: string) => string;
  title: string;
  myId: string | null;
  activeKey?: string;
}) {
  const t = useT(chatDict);
  const [query, setQuery] = useState("");

  const totalUnread = threads.reduce((sum, thread) => sum + thread.unreadCount, 0);

  const filtered = threads
    .filter((thread) => thread.name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice()
    .sort(
      (a, b) =>
        new Date(b.lastMessage.created_at).getTime() -
        new Date(a.lastMessage.created_at).getTime(),
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-3.5 px-1 pb-3.5">
        <div className="flex items-center gap-2.5">
          <h1 className="font-display text-[26px] leading-none font-bold text-ink">{title}</h1>
          {totalUnread > 0 && (
            <span className="rounded-full bg-accent px-2 py-0.5 font-number text-[11px] font-bold text-accent-ink">
              {totalUnread > 99 ? "99+" : toBanglaDigits(totalUnread)}
            </span>
          )}
        </div>

        {threads.length > 0 && (
          // Pill-shaped and inset: the search sits in the surface rather than
          // on it, so it doesn't compete with the conversation rows below.
          <div className="group relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted transition-colors group-focus-within:text-accent" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className={cn(
                "h-11 w-full rounded-full border border-line bg-soft pr-10 pl-10.5 text-sm text-ink",
                "transition-[background-color,border-color,box-shadow] duration-150",
                "placeholder:text-muted/70 hover:bg-card",
                "focus:border-accent focus:bg-card focus:ring-4 focus:ring-accent/12 focus:outline-none",
              )}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                title={t("clearSearch")}
                aria-label={t("clearSearch")}
                className="absolute top-1/2 right-2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted transition-colors hover:bg-soft hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {isPending ? (
        <ThreadListSkeleton />
      ) : threads.length === 0 ? (
        <EmptyState
          dashed
          className="mt-2"
          icon={<MessageCircle className="h-6 w-6" />}
          title={t("noConversationsTitle")}
          description={t("noConversationsDesc")}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          dashed
          className="mt-2"
          icon={<Search className="h-6 w-6" />}
          title={t("noSearchResultsTitle")}
          description={t("noSearchResultsDesc")}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-1">
          {filtered.map((thread) => {
            const mine = thread.lastMessage.sender_id === myId;
            const active = thread.key === activeKey;
            const unread = thread.unreadCount > 0;
            return (
              <Link
                key={thread.key}
                href={hrefFor(thread.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-[18px] py-3 pr-3 pl-3.5",
                  "transition-[background-color,box-shadow] duration-150",
                  "focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none",
                  active
                    ? "bg-accent/[0.07] shadow-xs"
                    : "hover:bg-soft active:bg-soft",
                )}
              >
                {/* A short accent rail rather than a filled row — the selection
                    stays obvious without the item turning into a button. */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1/2 left-0 w-[3px] -translate-y-1/2 rounded-r-full bg-accent transition-all duration-200",
                    active ? "h-7 opacity-100" : "h-0 opacity-0",
                  )}
                />

                <div className="relative shrink-0">
                  <AvatarChip
                    label={thread.name}
                    avatarUrl={thread.avatarUrl}
                    shape="circle"
                    size={52}
                    className={cn(
                      "transition-shadow duration-150",
                      active ? "shadow-sm ring-2 ring-accent/25" : "group-hover:shadow-sm",
                    )}
                  />
                  {unread && (
                    <span
                      aria-hidden
                      className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-accent ring-2 ring-card"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p
                      className={cn(
                        "min-w-0 flex-1 truncate text-[14.5px]",
                        unread ? "font-bold text-ink" : "font-semibold text-ink",
                      )}
                    >
                      {thread.name}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 font-number text-[11px] tabular-nums",
                        unread ? "font-semibold text-accent" : "text-muted",
                      )}
                    >
                      {timeLabel(thread.lastMessage.created_at)}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-1.5">
                    {mine &&
                      (thread.lastMessage.is_read ? (
                        <CheckCheck className="h-3.5 w-3.5 shrink-0 text-accent" />
                      ) : (
                        <Check className="h-3.5 w-3.5 shrink-0 text-muted" />
                      ))}
                    <p
                      className={cn(
                        "min-w-0 flex-1 truncate text-[13px]",
                        unread ? "font-semibold text-ink" : "text-muted",
                      )}
                    >
                      {previewText(thread)}
                    </p>
                    {unread && (
                      <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 font-number text-[11px] font-bold text-accent-ink shadow-xs">
                        {thread.unreadCount > 9 ? "9+" : toBanglaDigits(thread.unreadCount)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
