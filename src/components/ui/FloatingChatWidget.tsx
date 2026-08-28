"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStreamingChat, type ChatErrorCode } from "@/hooks/use-streaming-chat";
import { AssistantOrb } from "./AssistantOrb";

export interface FloatingChatLabels {
  name: string;
  subtitle: string;
  openLabel: string;
  closeLabel: string;
  greeting: string;
  suggestions: string[];
  placeholder: string;
  sendLabel: string;
  stopLabel: string;
  /** The line that stops this being mistaken for a human thread. */
  footnote: string;
  errNotSignedIn: string;
  errNoKey: string;
  errGeneric: string;
}

/**
 * The floating assistant, shared by both apps.
 *
 * Customer and shop get the same widget pointed at different endpoints — one
 * component rather than two that drift apart the first time one of them is
 * fixed. Everything specific to an app arrives as labels, so this file has no
 * opinion about who is using it.
 *
 * Two placement details are load-bearing rather than cosmetic. It sits above
 * the mobile bottom navigation: pinned to bottom-6 it would cover a nav tab on
 * every phone, which is how a helpful feature becomes a daily annoyance. And it
 * is styled unlike the app's human message threads, with a footnote saying so —
 * someone who mistakes it for a person is confused twice, once when it knows
 * their queue position and again when it cannot pass on a message.
 */
export function FloatingChatWidget({
  endpoint,
  labels,
}: {
  endpoint: string;
  labels: FloatingChatLabels;
}) {
  const [open, setOpen] = useState(false);
  const { turns, streaming, error, send, stop } = useStreamingChat(endpoint);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = (text: string) => {
    setDraft("");
    void send(text);
    inputRef.current?.focus();
  };

  const errorMessage =
    error === "NOT_SIGNED_IN"
      ? labels.errNotSignedIn
      : error === "ANTHROPIC_KEY_MISSING"
        ? labels.errNoKey
        : labels.errGeneric;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={labels.openLabel}
          // bottom-24 clears the mobile bottom bar; lg:bottom-6 takes the space
          // back on desktop, where that bar does not exist.
          className="fixed right-4 bottom-24 z-30 grid h-13 w-13 place-items-center rounded-full bg-accent text-accent-ink shadow-lg transition-transform active:scale-95 lg:right-6 lg:bottom-6"
        >
          <AssistantOrb size={24} state={streaming ? "thinking" : "idle"} />
        </button>
      )}

      {open && (
        <>
          {/* Dimmed backdrop on phones only — on desktop the panel is small
              enough to sit over the page without taking it hostage. */}
          <div
            className="fixed inset-0 z-30 bg-ink/40 backdrop-blur-[2px] lg:hidden"
            onClick={() => setOpen(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={labels.name}
            className="fixed right-3 bottom-20 left-3 z-40 flex max-h-[70dvh] flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-2xl sm:left-auto sm:w-96 lg:right-6 lg:bottom-6 lg:max-h-[34rem]"
          >
            <header className="flex shrink-0 items-center gap-2.5 border-b border-line bg-soft px-4 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
                <AssistantOrb size={17} state={streaming ? "thinking" : "idle"} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-ink">{labels.name}</span>
                <span className="block text-[10px] text-muted">{labels.subtitle}</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={labels.closeLabel}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-card hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3.5">
              <div className="rounded-2xl bg-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-ink">
                {labels.greeting}
              </div>

              {turns.length === 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {labels.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submit(s)}
                      className="rounded-full border border-line bg-card px-2.5 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:border-accent/50 hover:text-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {turns.map((turn, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap",
                    turn.role === "user"
                      ? "ml-auto bg-accent text-accent-ink"
                      : "bg-soft text-ink",
                  )}
                >
                  {turn.content || <TypingDots />}
                </div>
              ))}

              {error && (
                <p className="rounded-xl bg-live-soft px-3.5 py-2.5 text-[12px] text-live">
                  {errorMessage}
                </p>
              )}
              <div ref={endRef} />
            </div>

            <form
              className="shrink-0 border-t border-line px-3 pt-2.5 pb-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit(draft);
              }}
            >
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={labels.placeholder}
                  maxLength={1000}
                  className="min-w-0 flex-1 rounded-xl border border-line bg-soft px-3.5 py-2.5 text-[13px] text-ink outline-none placeholder:text-muted focus:border-accent"
                />
                {streaming ? (
                  <button
                    type="button"
                    onClick={stop}
                    aria-label={labels.stopLabel}
                    className="grid h-9.5 w-9.5 shrink-0 place-items-center rounded-xl border border-line bg-card text-muted transition-colors hover:text-ink"
                  >
                    <Square className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    aria-label={labels.sendLabel}
                    className="grid h-9.5 w-9.5 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink transition-opacity disabled:opacity-40"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-center text-[10px] text-muted">{labels.footnote}</p>
            </form>
          </div>
        </>
      )}
    </>
  );
}

function TypingDots() {
  return (
    <span className="flex gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

export type { ChatErrorCode };
