"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, MessageCircle, Send } from "lucide-react";
import { toBanglaDigits } from "@/lib/format-wait";
import type { Message } from "@/types";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { useChatThread } from "../hooks/use-chat-thread";

function dateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "আজ";
  if (date.toDateString() === yesterday.toDateString()) return "গতকাল";
  return toBanglaDigits(date.getDate()) + " " + date.toLocaleDateString("bn-BD", { month: "long" });
}

function timeLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const hh = toBanglaDigits(d.getHours()).padStart(2, "০");
  const mm = toBanglaDigits(d.getMinutes()).padStart(2, "০");
  return `${hh}:${mm}`;
}

export function ChatThreadView({
  shopId,
  customerId,
  backHref,
  otherPartyName,
  otherPartyInitial,
  otherPartyAvatarBg = "var(--color-accent)",
}: {
  shopId: string | undefined;
  customerId: string | undefined;
  backHref: string;
  otherPartyName: string;
  otherPartyInitial: string;
  otherPartyAvatarBg?: string;
}) {
  const { myId, messages, isPending, send } = useChatThread(shopId, customerId);
  const [content, setContent] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const showToast = useToast();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSend = () => {
    const text = content.trim();
    if (!text) return;
    setContent("");
    send.mutate(text, {
      onError: (err) => {
        showToast(err instanceof Error ? err.message : "মেসেজ পাঠানো যায়নি।");
        setContent(text);
      },
    });
  };

  const grouped = useMemo(() => {
    const rows: { message: Message; label: string; showLabel: boolean }[] = [];
    let last = "";
    for (const message of messages) {
      const label = dateLabel(message.created_at);
      rows.push({ message, label, showLabel: label !== last });
      last = label;
    }
    return rows;
  }, [messages]);

  return (
    <div className="mx-auto flex h-[calc(100dvh-5.5rem)] max-w-lg flex-col md:h-[calc(100dvh-2.5rem)]">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-line pb-3.5">
        <Link
          href={backHref}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-soft"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display font-bold text-white"
          style={{ background: otherPartyAvatarBg }}
        >
          {otherPartyInitial}
        </div>
        <p className="min-w-0 flex-1 truncate font-display text-[15px] font-bold text-ink">
          {otherPartyName}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-3.5">
        {isPending ? (
          <div className="grid h-full place-items-center">
            <Spinner className="h-6 w-6 text-muted" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="grid h-13 w-13 place-items-center rounded-full bg-accent/10 text-accent">
              <MessageCircle className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-ink">{otherPartyName}-কে হ্যালো বলো</p>
            <p className="text-xs text-muted">কথোপকথন শুরু করো</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {grouped.map(({ message: m, label, showLabel }) => {
              const mine = m.sender_id === myId;
              return (
                <div key={m.id}>
                  {showLabel && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-full bg-soft px-3 py-1 text-[11px] text-muted">
                        {label}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        mine
                          ? "rounded-br-sm bg-accent text-accent-ink"
                          : "rounded-bl-sm border border-line bg-card text-ink"
                      }`}
                    >
                      <p className="leading-relaxed wrap-break-word">{m.content}</p>
                      <p
                        className={`mt-1 text-right text-[10px] ${mine ? "text-accent-ink/70" : "text-muted"}`}
                      >
                        {timeLabel(m.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-line pt-3">
        <div className="flex items-center gap-2">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="মেসেজ লেখো…"
            className="flex-1 rounded-full border border-line bg-soft px-4 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={send.isPending || !content.trim()}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
