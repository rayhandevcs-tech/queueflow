"use client";

import Link from "next/link";
import { toBanglaDigits } from "@/lib/format-wait";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { MessageCircle } from "lucide-react";
import { getStoredLanguage, translate, useT } from "@/lib/i18n";
import type { ChatThreadSummary } from "../hooks/use-chat-threads";
import { chatDict } from "../lib/i18n";

function previewText(thread: ChatThreadSummary): string {
  if (thread.lastMessage.image_url) return translate(chatDict, "photoPreview");
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
}: {
  threads: ChatThreadSummary[];
  isPending: boolean;
  hrefFor: (key: string) => string;
  title: string;
}) {
  const t = useT(chatDict);

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-[27px] font-bold text-ink">{title}</h1>

      {threads.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="h-6 w-6" />}
          title={t("noConversationsTitle")}
          description={t("noConversationsDesc")}
        />
      ) : (
        <div className="flex flex-col gap-1">
          {threads
            .slice()
            .sort(
              (a, b) =>
                new Date(b.lastMessage.created_at).getTime() -
                new Date(a.lastMessage.created_at).getTime(),
            )
            .map((thread) => (
              <Link
                key={thread.key}
                href={hrefFor(thread.key)}
                className="flex items-center gap-3 rounded-2xl px-2.5 py-3 hover:bg-soft"
              >
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl font-display font-bold text-white"
                  style={{ background: shopAvatarColor(thread.key) }}
                >
                  {thread.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thread.avatarUrl}
                      alt={thread.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    shopInitial(thread.name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{thread.name}</p>
                  <p
                    className={`truncate text-[13px] ${thread.unread ? "font-semibold text-ink" : "text-muted"}`}
                  >
                    {previewText(thread)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-[11px] text-muted">
                    {timeLabel(thread.lastMessage.created_at)}
                  </span>
                  {thread.unread && <span className="h-2 w-2 rounded-full bg-accent" />}
                </div>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
