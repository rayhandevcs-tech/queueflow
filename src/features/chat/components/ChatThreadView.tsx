"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ImagePlus, MessageCircle, Send } from "lucide-react";
import { toBanglaDigits } from "@/lib/format-wait";
import type { Message } from "@/types";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { getStoredLanguage, translate, useT } from "@/lib/i18n";
import { uploadChatImage } from "../api/storage.api";
import { useChatPresence } from "../hooks/use-chat-presence";
import { useChatThread } from "../hooks/use-chat-thread";
import { chatDict } from "../lib/i18n";

function dateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return translate(chatDict, "today");
  if (date.toDateString() === yesterday.toDateString()) return translate(chatDict, "yesterday");
  if (getStoredLanguage() === "en") {
    return date.toLocaleDateString("en-US", { day: "numeric", month: "long" });
  }
  return toBanglaDigits(date.getDate()) + " " + date.toLocaleDateString("bn-BD", { month: "long" });
}

function timeLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (getStoredLanguage() === "en") {
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const showToast = useToast();
  const t = useT(chatDict);

  const otherOnline = useChatPresence(
    shopId && customerId ? `presence:chat:${shopId}:${customerId}` : undefined,
    myId ?? undefined,
  );

  const lastActiveLabel = useMemo(() => {
    if (messages.length === 0) return null;
    const last = messages[messages.length - 1];
    return t("lastActiveAt", `${dateLabel(last.created_at)} ${timeLabel(last.created_at)}`);
  }, [messages, t]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSend = () => {
    const text = content.trim();
    if (!text) return;
    setContent("");
    send.mutate(
      { content: text },
      {
        onError: (err) => {
          showToast(err instanceof Error ? err.message : t("messageSendFailed"));
          setContent(text);
        },
      },
    );
  };

  const onPickImage = async (file: File | undefined) => {
    if (!file || !shopId || !customerId) return;
    setUploadingImage(true);
    try {
      const url = await uploadChatImage(shopId, customerId, file);
      send.mutate(
        { imageUrl: url },
        {
          onError: (err) => {
            showToast(err instanceof Error ? err.message : t("imageSendFailed"));
          },
        },
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("imageUploadFailed"));
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
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
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-bold text-ink">{otherPartyName}</p>
          {otherOnline ? (
            <p className="flex items-center gap-1 text-[11px] text-good">
              <span className="h-1.5 w-1.5 rounded-full bg-good" />
              {t("onlineStatus")}
            </p>
          ) : (
            lastActiveLabel && <p className="truncate text-[11px] text-muted">{lastActiveLabel}</p>
          )}
        </div>
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
            <p className="text-sm font-medium text-ink">{t("sayHello", otherPartyName)}</p>
            <p className="text-xs text-muted">{t("startConversation")}</p>
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
                      {m.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.image_url}
                          alt=""
                          className="mb-1.5 max-h-64 w-full rounded-xl object-cover"
                        />
                      )}
                      {m.content && <p className="leading-relaxed wrap-break-word">{m.content}</p>}
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
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPickImage(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploadingImage}
            title={t("sendImageTitle")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-soft disabled:opacity-40"
          >
            {uploadingImage ? <Spinner className="h-4 w-4" /> : <ImagePlus className="h-5 w-5" />}
          </button>
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={t("messagePlaceholder")}
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
