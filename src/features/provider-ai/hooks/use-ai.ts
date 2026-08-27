"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { ShopInsights } from "../lib/insights-schema";

export type AiErrorCode = "NO_DATA" | "ANTHROPIC_KEY_MISSING" | "GENERIC";

function codeFrom(status: number, body: unknown): AiErrorCode {
  const error =
    body && typeof body === "object" && "error" in body ? String(body.error) : null;
  if (error === "NO_DATA") return "NO_DATA";
  if (error === "ANTHROPIC_KEY_MISSING") return "ANTHROPIC_KEY_MISSING";
  return status === 422 ? "NO_DATA" : "GENERIC";
}

export class AiError extends Error {
  constructor(public code: AiErrorCode) {
    super(code);
  }
}

export function useShopInsights() {
  return useMutation<{ insights: ShopInsights; generatedAt: string }, AiError>({
    mutationFn: async () => {
      const res = await fetch("/api/ai/insights", { method: "POST" });
      if (!res.ok) {
        throw new AiError(codeFrom(res.status, await res.json().catch(() => null)));
      }
      return res.json();
    },
  });
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * A streaming chat kept in component state.
 *
 * Not TanStack Query: this is a stream appended to token by token, not a
 * request with a cacheable result, and the thread is deliberately not persisted
 * — it is a scratchpad over numbers the owner can always re-derive, so there is
 * nothing worth storing and nothing to clean up later.
 */
export function useShopChat() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<AiErrorCode | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || streaming) return;

      setError(null);
      const history: ChatTurn[] = [...turns, { role: "user", content: question }];
      // The empty assistant turn is what the typing indicator renders into.
      setTurns([...history, { role: "assistant", content: "" }]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          setError(codeFrom(res.status, await res.json().catch(() => null)));
          setTurns(history); // drop the empty assistant turn
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

        // A stream that closed before producing anything is a failure, not an
        // answer — leaving a blank bubble would read as the model having
        // nothing to say.
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
