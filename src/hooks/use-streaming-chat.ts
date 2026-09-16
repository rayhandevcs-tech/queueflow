"use client";

import { useCallback, useRef, useState } from "react";

export type ChatErrorCode = "NOT_SIGNED_IN" | "ANTHROPIC_KEY_MISSING" | "GENERIC";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * A streaming chat thread against any of our text/plain streaming endpoints.
 *
 * Shared because the customer's help assistant and the shop's own assistant are
 * the same mechanism pointed at different data — one hook rather than two that
 * drift apart the first time one of them grows a bug fix.
 *
 * Nothing is persisted. An exchange about "where am I in the queue" is
 * worthless five minutes later, and storing it would mean a table of people's
 * questions to secure, expire and eventually explain. The thread survives
 * closing and reopening the panel because the hook lives above it; it does not
 * survive a reload, which is the right trade for what this is.
 */
export function useStreamingChat(endpoint: string) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<ChatErrorCode | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || streaming) return;

      setError(null);
      const history: ChatTurn[] = [...turns, { role: "user", content: question }];
      setTurns([...history, { role: "assistant", content: "" }]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          // The status is the primary signal and the body's code is the
          // refinement. The AI routes are not consistent about the code — the
          // help route says NOT_SIGNED_IN, the agent and the other four say
          // UNAUTHORIZED — and matching on the code alone turned a 401 from
          // any of them into "something went wrong", which is the one error
          // message a customer cannot act on. A 401 means sign in, whatever
          // the route chose to call it.
          setError(
            res.status === 401
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
    [turns, streaming, endpoint],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { turns, streaming, error, send, stop };
}
