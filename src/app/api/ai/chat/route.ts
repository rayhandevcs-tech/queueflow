import { NextResponse } from "next/server";
import { z } from "zod";
import { AI_MODEL, ANTHROPIC_KEY_MISSING, getAnthropicClient } from "@/lib/anthropic/client";
import { gatherShopBrief, NO_SHOP } from "@/features/provider-ai/api/gather-brief";
import { briefAsPrompt, CHAT_SYSTEM } from "@/features/provider-ai/lib/prompt";

/**
 * History is capped because the client sends it back every turn and a runaway
 * thread is a runaway bill. Twenty turns is far more than a "how did last month
 * go" conversation ever needs.
 */
const MAX_TURNS = 20;
const MAX_MESSAGE_CHARS = 2000;

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
    brief = await gatherShopBrief();
  } catch (err) {
    if (err instanceof Error && err.message === NO_SHOP) {
      return NextResponse.json({ error: NO_SHOP }, { status: 403 });
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

  // The brief is the same on every turn of a conversation, and it is the bulk
  // of the tokens — so it goes in the system block behind a cache breakpoint,
  // ahead of the messages. Later turns then re-read it at a tenth of the cost
  // instead of paying full price for the same JSON again.
  const stream = client.messages.stream({
    model: AI_MODEL,
    max_tokens: 64000,
    system: [
      { type: "text", text: CHAT_SYSTEM },
      { type: "text", text: briefAsPrompt(brief), cache_control: { type: "ephemeral" } },
    ],
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
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
        // The turn died mid-answer. Close the stream rather than leaving the
        // browser waiting on a response that will never finish; the client
        // shows what arrived plus a retry.
      } finally {
        controller.close();
      }
    },
    cancel() {
      // The owner navigated away or asked something else — stop generating
      // rather than paying for tokens nobody will read.
      stream.abort();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
