import { NextResponse } from "next/server";
import { z } from "zod";
import { AI_MODEL, ANTHROPIC_KEY_MISSING, getAnthropicClient } from "@/lib/anthropic/client";
import { gatherCustomerBrief, NOT_SIGNED_IN } from "@/features/customer-help/api/gather-brief";
import {
  CUSTOMER_HELP_SYSTEM,
  customerBriefAsPrompt,
} from "@/features/customer-help/lib/prompt";

/** History is resent every turn, so a runaway thread is a runaway bill. */
const MAX_TURNS = 20;
const MAX_MESSAGE_CHARS = 1000;

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(MAX_MESSAGE_CHARS),
      }),
    )
    .min(1)
    .max(MAX_TURNS),
});

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  let brief;
  try {
    brief = await gatherCustomerBrief();
  } catch (err) {
    if (err instanceof Error && err.message === NOT_SIGNED_IN) {
      return NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 });
    }
    throw err;
  }

  let client;
  try {
    client = getAnthropicClient();
  } catch (err) {
    if (err instanceof Error && err.message === ANTHROPIC_KEY_MISSING) {
      return NextResponse.json({ error: ANTHROPIC_KEY_MISSING }, { status: 503 });
    }
    throw err;
  }

  // The app knowledge is identical for every customer and every question, so it
  // sits first behind its own breakpoint and is read from cache across all of
  // them. The customer's own brief is stable within one conversation and gets
  // the second breakpoint. Only the questions after it are ever new tokens.
  const stream = client.messages.stream({
    model: AI_MODEL,
    max_tokens: 64000,
    system: [
      { type: "text", text: CUSTOMER_HELP_SYSTEM, cache_control: { type: "ephemeral" } },
      {
        type: "text",
        text: customerBriefAsPrompt(brief),
        cache_control: { type: "ephemeral" },
      },
    ],
    thinking: { type: "adaptive" },
    // A help desk answer is two or three sentences about facts already on the
    // screen; there is nothing here that repays deeper reasoning.
    output_config: { effort: "low" },
    messages: parsed.data.messages,
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch {
        // Close rather than leave the browser waiting on an answer that will
        // never arrive; the widget shows what came through, plus a retry.
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
