"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, MessageCircleQuestion, Sparkles, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useHelpChat, type HelpErrorCode } from "../hooks/use-help-chat";
import { customerHelpDict } from "../lib/i18n";

/**
 * The floating help assistant.
 *
 * Two things about the placement are load-bearing rather than cosmetic. It sits
 * above the mobile bottom navigation — a bubble pinned to bottom-6 would cover
 * the Profile tab on every phone, which is how a helpful feature becomes a
 * daily annoyance. And it is styled deliberately unlike the shop's message
 * thread: this answers as software, and a customer who mistakes it for their
 * barber will be confused twice — once when it knows their queue position, and
 * again when it cannot pass on a message.
 */
export function HelpChatWidget() {
  const t = useT(customerHelpDict);
  const [open, setOpen] = useState(false);
  const { turns, streaming, error, send, stop } = useHelpChat();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns, open]);

  // Escape closes it, like every other dismissible surface in the app.
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

  const suggestions = [
    t("suggestion1"),
    t("suggestion2"),
    t("suggestion3"),
    t("suggestion4"),
  ];

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("openLabel")}
          // bottom-24 clears the mobile bottom bar; lg:bottom-6 takes the space
          // back on desktop, where that bar does not exist.
          className="fixed right-4 bottom-24 z-30 grid h-13 w-13 place-items-center rounded-full bg-accent text-accent-ink shadow-lg transition-transform active:scale-95 lg:right-6 lg:bottom-6"
        >
          <MessageCircleQuestion className="h-6 w-6" />
        </button>
      )}

      {open && (
        <>
          {/* Dimmed backdrop on phones only. On desktop the panel is small
              enough to sit over the page without taking it hostage. */}
          <div
            className="fixed inset-0 z-30 bg-ink/40 backdrop-blur-[2px] lg:hidden"
            onClick={() => setOpen(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("botName")}
            className="fixed right-3 bottom-20 left-3 z-40 flex max-h-[70dvh] flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-2xl sm:left-auto sm:w-96 lg:right-6 lg:bottom-6 lg:max-h-[34rem]"
          >
            <header className="flex shrink-0 items-center gap-2.5 border-b border-line bg-soft px-4 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-ink">{t("botName")}</span>
                <span className="block text-[10px] text-muted">{t("botSubtitle")}</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("closeLabel")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-card hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3.5">
              <div className="rounded-2xl bg-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-ink">
                {t("greeting")}
              </div>

              {turns.length === 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {suggestions.map((s) => (
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

              {error && <ErrorNote code={error} />}
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
                  placeholder={t("placeholder")}
                  maxLength={1000}
                  className="min-w-0 flex-1 rounded-xl border border-line bg-soft px-3.5 py-2.5 text-[13px] text-ink outline-none placeholder:text-muted focus:border-accent"
                />
                {streaming ? (
                  <button
                    type="button"
                    onClick={stop}
                    aria-label={t("stopLabel")}
                    className="grid h-9.5 w-9.5 shrink-0 place-items-center rounded-xl border border-line bg-card text-muted transition-colors hover:text-ink"
                  >
                    <Square className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    aria-label={t("sendLabel")}
                    className="grid h-9.5 w-9.5 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink transition-opacity disabled:opacity-40"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-center text-[10px] text-muted">
                {t("notTheShopNote")}
              </p>
            </form>
          </div>
        </>
      )}
    </>
  );
}

function ErrorNote({ code }: { code: HelpErrorCode }) {
  const t = useT(customerHelpDict);
  const message =
    code === "NOT_SIGNED_IN"
      ? t("errSignedOut")
      : code === "ANTHROPIC_KEY_MISSING"
        ? t("errNoKey")
        : t("errGeneric");

  return (
    <p className="rounded-xl bg-live-soft px-3.5 py-2.5 text-[12px] text-live">{message}</p>
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
