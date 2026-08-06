"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Camera, ChevronLeft, ImagePlus, MessageCircle, Send } from "lucide-react";
import { toBanglaDigits } from "@/lib/format-wait";
import type { Message } from "@/types";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { useToast } from "@/components/ui/Toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { getStoredLanguage, translate, useT } from "@/lib/i18n";
import { uploadChatImages } from "../api/storage.api";
import { getMessageImageUrls } from "../lib/message-images";
import { useChatPresence } from "../hooks/use-chat-presence";
import { useChatThread } from "../hooks/use-chat-thread";
import { chatDict } from "../lib/i18n";
import { MessageImageGrid } from "./MessageImageGrid";

/** A barely-there dot weave: enough tooth that white bubbles sit *on* the
 *  thread rather than dissolving into it, not enough to read as a pattern. */
const THREAD_TEXTURE =
  "bg-[radial-gradient(circle_at_1px_1px,rgba(27,24,18,0.055)_1px,transparent_0)] bg-[length:22px_22px]";

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

/** Alternating bubble stubs so the loading thread has the shape of a thread. */
function ThreadSkeleton() {
  const rows = [
    { mine: false, w: "w-40" },
    { mine: true, w: "w-32" },
    { mine: false, w: "w-52" },
    { mine: true, w: "w-44" },
    { mine: false, w: "w-36" },
  ];
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {rows.map((row, i) => (
        <div key={i} className={cn("flex", row.mine ? "justify-end" : "justify-start")}>
          <Skeleton
            className={cn(
              "h-10 rounded-[20px]",
              row.w,
              row.mine ? "rounded-br-md" : "rounded-bl-md",
            )}
          />
        </div>
      ))}
    </div>
  );
}

export function ChatThreadView({
  shopId,
  customerId,
  backHref,
  otherPartyName,
  otherPartyAvatarUrl = null,
}: {
  shopId: string | undefined;
  customerId: string | undefined;
  backHref: string;
  otherPartyName: string;
  otherPartyAvatarUrl?: string | null;
}) {
  const { myId, messages, isPending, send } = useChatThread(shopId, customerId);
  const [content, setContent] = useState("");
  const [uploadingImages, setUploadingImages] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
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

  const onPickImages = async (files: File[]) => {
    if (files.length === 0 || !shopId || !customerId) return;
    setUploadingImages(true);
    try {
      const urls = await uploadChatImages(shopId, customerId, files);
      send.mutate(
        { imageUrls: urls },
        {
          onError: (err) => {
            showToast(err instanceof Error ? err.message : t("imageSendFailed"));
          },
        },
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("imageUploadFailed"));
    } finally {
      setUploadingImages(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  /* Consecutive messages from one sender read as one turn: they sit closer
     together and only the last of the run gets the tail corner. */
  const grouped = useMemo(() => {
    const rows: {
      message: Message;
      label: string;
      showLabel: boolean;
      lastOfRun: boolean;
    }[] = [];
    let last = "";
    messages.forEach((message, i) => {
      const label = dateLabel(message.created_at);
      const next = messages[i + 1];
      const lastOfRun =
        !next ||
        next.sender_id !== message.sender_id ||
        dateLabel(next.created_at) !== label;
      rows.push({ message, label, showLabel: label !== last, lastOfRun });
      last = label;
    });
    return rows;
  }, [messages]);

  const canSend = !!content.trim() && !send.isPending;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-line bg-card px-3 py-2.5 shadow-xs">
        <Link
          href={backHref}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-soft hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="relative shrink-0">
          <AvatarChip
            label={otherPartyName}
            avatarUrl={otherPartyAvatarUrl}
            shape="circle"
            size={42}
            className="shadow-xs"
          />
          {otherOnline && (
            <span
              aria-hidden
              className="absolute right-0 bottom-0 h-3 w-3 rounded-full bg-good ring-2 ring-card"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15.5px] font-bold text-ink">{otherPartyName}</p>
          {otherOnline ? (
            <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-good">
              <span className="h-1.5 w-1.5 animate-pulse-live rounded-full bg-good" />
              {t("onlineStatus")}
            </p>
          ) : (
            lastActiveLabel && <p className="truncate text-[11.5px] text-muted">{lastActiveLabel}</p>
          )}
        </div>
      </header>

      <div className={cn("flex-1 overflow-y-auto bg-paper px-3 py-4 sm:px-5", THREAD_TEXTURE)}>
        {isPending ? (
          <ThreadSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-accent/[0.07] ring-1 ring-accent/10">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-card text-accent shadow-sm">
                <MessageCircle className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="font-display text-base font-bold text-ink">
                {t("sayHello", otherPartyName)}
              </p>
              <p className="text-[13px] text-muted">{t("startConversation")}</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col">
            {grouped.map(({ message: m, label, showLabel, lastOfRun }) => {
              const mine = m.sender_id === myId;
              return (
                <div key={m.id}>
                  {showLabel && (
                    <div className="my-3.5 flex justify-center">
                      <span className="rounded-full border border-line bg-card/90 px-3.5 py-1 text-[11px] font-semibold text-muted shadow-xs backdrop-blur-sm">
                        {label}
                      </span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex animate-fade-up",
                      mine ? "justify-end" : "justify-start",
                      lastOfRun ? "mb-2.5" : "mb-0.5",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] px-3.5 py-2.5 text-[14.5px] sm:max-w-[72%]",
                        // The tail corner marks the speaker and only appears on
                        // the last bubble of a run, so a burst reads as one turn.
                        mine
                          ? "rounded-[20px] bg-accent text-accent-ink shadow-sm"
                          : "rounded-[20px] border border-line bg-card text-ink shadow-xs",
                        lastOfRun && (mine ? "rounded-br-[6px]" : "rounded-bl-[6px]"),
                      )}
                    >
                      <MessageImageGrid urls={getMessageImageUrls(m)} />
                      {m.content && <p className="leading-relaxed wrap-break-word">{m.content}</p>}
                      <p
                        className={cn(
                          "mt-0.5 text-right font-number text-[10px] tabular-nums",
                          mine ? "text-accent-ink/70" : "text-muted/80",
                        )}
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

      <div className="shrink-0 border-t border-line bg-card px-3 py-3 sm:px-4">
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void onPickImages(Array.from(e.target.files ?? []))}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onPickImages(Array.from(e.target.files ?? []))}
          />

          {/* Input and its two attachment buttons share one pill, so the
              composer reads as a single field rather than four controls. */}
          <div className="flex min-h-11 flex-1 items-center gap-1 rounded-full border border-line bg-soft px-1.5 transition-[background-color,border-color,box-shadow] duration-150 focus-within:border-accent focus-within:bg-card focus-within:ring-4 focus-within:ring-accent/12">
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={uploadingImages}
              title={t("attachImageTitle")}
              aria-label={t("attachImageTitle")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-line hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none disabled:opacity-40"
            >
              {uploadingImages ? <Spinner className="h-4 w-4" /> : <ImagePlus className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploadingImages}
              title={t("cameraTitle")}
              aria-label={t("cameraTitle")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-line hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none disabled:opacity-40"
            >
              <Camera className="h-5 w-5" />
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
              aria-label={t("messagePlaceholder")}
              className="min-w-0 flex-1 bg-transparent py-2 pr-2 text-[14.5px] text-ink outline-none placeholder:text-muted/70"
            />
          </div>

          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            title={t("sendMessageTitle")}
            aria-label={t("sendMessageTitle")}
            aria-busy={send.isPending || undefined}
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-full text-accent-ink",
              "bg-gradient-to-br from-accent to-[#c03d47] shadow-sm",
              "transition-[box-shadow,transform,opacity] duration-150",
              "hover:shadow-glow active:scale-95",
              "focus-visible:ring-4 focus-visible:ring-accent/35 focus-visible:outline-none",
              "disabled:scale-100 disabled:opacity-40 disabled:shadow-none",
            )}
          >
            {send.isPending ? <Spinner className="h-4 w-4" /> : <Send className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
