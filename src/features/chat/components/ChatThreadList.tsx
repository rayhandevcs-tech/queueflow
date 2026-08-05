"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, MessageCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toBanglaDigits } from "@/lib/format-wait";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
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

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  const filtered = threads.filter((thread) =>
    thread.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4">
      <h1 className="font-display text-[27px] font-bold text-ink">{title}</h1>

      {threads.length > 0 && (
        <Input
          icon={<Search className="h-4 w-4" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
        />
      )}

      {threads.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="h-6 w-6" />}
          title={t("noConversationsTitle")}
          description={t("noConversationsDesc")}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {filtered
            .slice()
            .sort(
              (a, b) =>
                new Date(b.lastMessage.created_at).getTime() -
                new Date(a.lastMessage.created_at).getTime(),
            )
            .map((thread) => {
              const mine = thread.lastMessage.sender_id === myId;
              return (
                <Link
                  key={thread.key}
                  href={hrefFor(thread.key)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-2.5 py-3",
                    thread.key === activeKey ? "bg-soft" : "hover:bg-soft",
                  )}
                >
                  <AvatarChip label={thread.name} avatarUrl={thread.avatarUrl} shape="circle" size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{thread.name}</p>
                    <p
                      className={cn(
                        "truncate text-[13px]",
                        thread.unread ? "font-semibold text-ink" : "text-muted",
                      )}
                    >
                      {previewText(thread)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="flex items-center gap-1 text-[11px] text-muted">
                      {mine && (
                        <Check
                          className={cn(
                            "h-3.5 w-3.5",
                            thread.lastMessage.is_read ? "text-accent" : "text-muted",
                          )}
                        />
                      )}
                      {timeLabel(thread.lastMessage.created_at)}
                    </span>
                    {thread.unreadCount > 0 && (
                      <Badge variant="accent" className="min-w-4.5 justify-center px-1.5 py-0.5">
                        {thread.unreadCount > 9 ? "9+" : toBanglaDigits(thread.unreadCount)}
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
        </div>
      )}
    </div>
  );
}
