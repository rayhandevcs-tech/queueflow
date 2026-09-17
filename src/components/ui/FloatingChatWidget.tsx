"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, Square, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStreamingChat, type ChatErrorCode } from "@/hooks/use-streaming-chat";
import { useDictation } from "@/hooks/use-dictation";
import { useSpeech } from "@/hooks/use-speech";
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
  /** Voice. Every one of these is optional: a caller that passes none gets
   *  the widget exactly as it was, and the buttons stay absent. */
  micLabel?: string;
  micStopLabel?: string;
  micHint?: string;
  micDenied?: string;
  listenLabel?: string;
  listenStopLabel?: string;
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
  renderProposal,
}: {
  endpoint: string;
  labels: FloatingChatLabels;
  /**
   * AI Sprint 3. Renders the confirmation card when a turn produced a
   * confirmable action, and is given nothing but the action's id.
   *
   * A render prop rather than an import, for two reasons. The boundary rule
   * (`shared → [shared]`) forbids this file importing a feature at all; and
   * beyond the lint rule, it would be wrong for the widget both apps share to
   * know that the customer app has proposals and the provider app does not.
   * The widget's job is the conversation. What may be confirmed inside one is
   * the caller's business.
   */
  renderProposal?: (proposalId: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { turns, streaming, error, send, stop, proposalId } = useStreamingChat(endpoint);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Voice, on both sides of the conversation.
   *
   * Speaking beats typing here for a reason specific to this product: Bangla on
   * a phone keyboard is slow, and the people using it are mid-shift with one
   * hand free. Both directions are the browser's own APIs — no vendor, no key,
   * no per-use cost — and both are absent rather than broken where the browser
   * lacks them.
   *
   * The mic writes into the draft rather than sending, which is the important
   * choice: recognition mishears, and a wrong question sent automatically costs
   * a round trip and reads as the assistant being stupid. The person sees the
   * text and presses send.
   */
  const dictation = useDictation();
  const speech = useSpeech();
  const voiceOn = !!labels.micLabel && dictation.supported;
  const listenOn = !!labels.listenLabel && speech.supported;

  // The live transcript IS the draft while listening: one source of truth, so
  // stopping mid-sentence leaves exactly what was heard in the box, editable.
  const shownDraft = dictation.listening ? dictation.transcript : draft;

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
    if (!text.trim()) return;
    // Sending while the mic is open would leave recognition running and append
    // the next words onto an already-sent question.
    dictation.reset();
    setDraft("");
    // Anything still being read aloud is about the previous answer.
    speech.stop();
    void send(text);
    inputRef.current?.focus();
  };

  const toggleMic = () => {
    if (dictation.listening) {
      // Keep what was heard: stop() ends recognition but the transcript is
      // what the person just said, and throwing it away would be the one
      // behaviour that makes the button not worth pressing.
      setDraft(dictation.transcript);
      dictation.stop();
      inputRef.current?.focus();
      return;
    }
    speech.stop(); // don't listen and talk at once
    dictation.start();
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

              {turns.map((turn, i) => {
                const speakingThis = speech.speakingId === String(i);
                // Only a finished answer can be read: a half-written one would
                // be cut off mid-sentence by the next chunk arriving.
                const canListen =
                  listenOn && turn.role === "assistant" && !!turn.content && !streaming;

                return (
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

                    {canListen && (
                      <button
                        type="button"
                        onClick={() => speech.toggle(String(i), turn.content)}
                        aria-label={
                          speakingThis
                            ? (labels.listenStopLabel ?? labels.listenLabel)
                            : labels.listenLabel
                        }
                        className={cn(
                          "mt-2 flex items-center gap-1.5 rounded-full px-2 py-1",
                          "text-[11px] font-semibold transition-colors",
                          speakingThis
                            ? "bg-accent/15 text-accent"
                            : "text-muted hover:bg-card hover:text-ink",
                        )}
                      >
                        {speakingThis ? (
                          <VolumeX className="h-3.5 w-3.5" />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" />
                        )}
                        {speakingThis
                          ? (labels.listenStopLabel ?? labels.listenLabel)
                          : labels.listenLabel}
                      </button>
                    )}
                  </div>
                );
              })}

              {/* After the answer, never instead of it. The assistant's words
                  explain the card, and the card is the thing that acts —
                  showing one without the other loses half the exchange.
                  `!streaming` keeps it from appearing under a half-written
                  sentence. */}
              {proposalId && renderProposal && !streaming && (
                <div className="w-full">{renderProposal(proposalId)}</div>
              )}

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
                {voiceOn && (
                  <button
                    type="button"
                    onClick={toggleMic}
                    aria-label={
                      dictation.listening
                        ? (labels.micStopLabel ?? labels.micLabel)
                        : labels.micLabel
                    }
                    aria-pressed={dictation.listening}
                    className={cn(
                      "grid h-9.5 w-9.5 shrink-0 place-items-center rounded-xl border transition-colors",
                      dictation.listening
                        ? "border-live bg-live text-white"
                        : "border-line bg-card text-muted hover:text-ink",
                    )}
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                )}
                <input
                  ref={inputRef}
                  value={shownDraft}
                  onChange={(e) => setDraft(e.target.value)}
                  // Typing over a live transcript would be overwritten by the
                  // next recognition result, so the box waits instead.
                  readOnly={dictation.listening}
                  placeholder={
                    dictation.listening
                      ? (labels.micHint ?? labels.placeholder)
                      : labels.placeholder
                  }
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
                    disabled={!shownDraft.trim()}
                    aria-label={labels.sendLabel}
                    className="grid h-9.5 w-9.5 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink transition-opacity disabled:opacity-40"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                )}
              </div>
              {/* Only the one error worth surfacing. "no-speech" and a failed
                  start are things the person can just try again, and a red
                  line for them would make the button feel unreliable when it
                  is not. A denied permission is different: nothing will work
                  until they change a browser setting. */}
              {voiceOn && dictation.error === "denied" && labels.micDenied && (
                <p className="mt-1.5 text-center text-[10px] text-live">{labels.micDenied}</p>
              )}
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
