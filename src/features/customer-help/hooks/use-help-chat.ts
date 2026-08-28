"use client";

import { useCallback, useRef, useState } from "react";

export type HelpErrorCode = "NOT_SIGNED_IN" | "ANTHROPIC_KEY_MISSING" | "GENERIC";

export interface HelpTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * The help thread, kept in component state for as long as the widget is mounted.
 *
 * Not persisted anywhere. A support exchange about "where am I in the queue" is
 * worthless five minutes later, and storing it would mean a table of customers'
 * questions to secure, expire and eventually explain. The thread survives
 * closing and reopening the panel because the hook lives above it; it does not
 * survive a reload, which is the right trade for what this is.
 */
export function useHelpChat() {
  const [turns, setTurns] = useState<HelpTurn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<HelpErrorCode | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || streaming) return;

      setError(null);
      const history: HelpTurn[] = [...turns, { role: "user", content: question }];
      setTurns([...history, { role: "assistant", content: "" }]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/ai/help", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(
            body?.error === "NOT_SIGNED_IN"
              ? "NOT_SIGNED_IN"
              : body?.error === "ANTHROPIC_KEY_MISSING"
                ? "ANTHROPIC_KEY_MISSING"
                : "GENERIC",
          );
          setTurns(history);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let answer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          answer += decoder.decode(value, { stream: true });
          setTurns([...history, { role: "assistant", content: answer }]);
        }

        // A stream that closed with nothing in it is a failure, not an answer —
        // an empty bubble reads as the assistant having nothing to say.
        if (!answer.trim()) {
          setError("GENERIC");
          setTurns(history);
        }
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          setError("GENERIC");
          setTurns(history);
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [turns, streaming],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { turns, streaming, error, send, stop };
}
