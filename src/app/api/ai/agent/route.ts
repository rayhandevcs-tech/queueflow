import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AI_MAX_TOKENS,
  AI_MODELS,
  ANTHROPIC_KEY_MISSING,
  getAnthropicClient,
} from "@/lib/anthropic/client";
import { createServerSupabase } from "@/lib/supabase/server";
import { runAgentLoop } from "@/lib/ai/agent-loop";
import { dhakaToday } from "@/lib/ai/tools/owner-analytics";
import type { AgentMessage, CallModel, ModelTurn } from "@/lib/ai/types";
import { OWNER_COPILOT_SYSTEM } from "@/features/provider-ai/lib/prompt";

/**
 * The agent endpoint.
 *
 * ---------------------------------------------------------------------------
 * The order of operations is the security model
 * ---------------------------------------------------------------------------
 * Identity is resolved BEFORE the model is given a single token, and it is
 * resolved from the session cookie:
 *
 *   1. `auth.getUser()` — who is this really
 *   2. the shop they own — which shop's figures may be read
 *   3. only then does the model get asked anything
 *
 * So there is no point in the request at which a model-supplied `shop_id` or
 * `owner_id` could be consulted, because by the time the model speaks the
 * context is already fixed and the tools take no identity arguments.
 *
 * Everything downstream then uses the cookie-bound client, which means RLS is
 * live on every query, and `analytics_scope` re-checks `is_shop_owner` inside
 * each RPC. The service-role client is deliberately absent from this whole
 * path: a request made on behalf of one shopkeeper has no business holding a
 * key that can read every shop on the platform. A test in
 * `src/lib/ai/agent.test.ts` asserts that no AI module imports or calls it —
 * which is why this sentence does not spell the function name with brackets.
 *
 * ---------------------------------------------------------------------------
 * Not streaming, and that is deliberate
 * ---------------------------------------------------------------------------
 * `/api/ai/chat` streams, because it has one model turn and nothing to decide.
 * This route may call tools between turns, and streaming text from a turn that
 * later turns out to be a tool request means either buffering it anyway or
 * showing the owner a sentence that gets replaced. Rule 22 said prefer
 * correctness, so: tools run, then the answer is returned whole. If the answer
 * ever gets long enough for the wait to hurt, the honest fix is streaming the
 * FINAL turn only, once the tool phase has finished.
 */

const MAX_TURNS = 12;
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

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Sprint 1 is the owner copilot. A customer reaching this endpoint is not an
  // error to explain in detail — they are told it is not for them, and no
  // customer-role registry slice is built, so there is nothing for a model to
  // be pointed at even by accident.
  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!shop) {
    return NextResponse.json({ error: "NO_SHOP" }, { status: 403 });
  }

  let client;
  try {
    client = getAnthropicClient();
  } catch (err) {
    if (err instanceof Error && err.message === ANTHROPIC_KEY_MISSING) {
      // The same controlled 503 the other five routes return, so the existing
      // UI already knows how to say "the assistant is not configured".
      return NextResponse.json({ error: ANTHROPIC_KEY_MISSING }, { status: 503 });
    }
    throw err;
  }

  const now = new Date();

  /**
   * The Anthropic-backed model call, adapting the SDK's block shapes to the
   * loop's own `ModelTurn`. Keeping the adaptation here is what lets the loop
   * be tested with no SDK and no key.
   */
  const callModel: CallModel = async ({ system, messages, tools }) => {
    const response = await client.messages.create({
      model: AI_MODELS.ownerCopilot,
      max_tokens: AI_MAX_TOKENS.copilot,
      system: [
        { type: "text", text: system, cache_control: { type: "ephemeral" } },
        { type: "text", text: `Today in the shop's timezone is ${dhakaToday(now)}.` },
      ],
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema as { type: "object" },
      })),
      messages: messages.map(toSdkMessage),
    });

    const turn: ModelTurn = { text: "", toolCalls: [], wantsTools: false };
    for (const block of response.content) {
      if (block.type === "text") turn.text += block.text;
      if (block.type === "tool_use") {
        turn.toolCalls.push({ id: block.id, name: block.name, input: block.input });
      }
    }
    turn.wantsTools = response.stop_reason === "tool_use" && turn.toolCalls.length > 0;
    return turn;
  };

  try {
    const result = await runAgentLoop({
      role: "owner",
      system: OWNER_COPILOT_SYSTEM,
      messages: parsed.data.messages.map((m) => ({ role: m.role, content: m.content })),
      ctx: { supabase, userId: user.id, shopId: shop.id, now },
      callModel,
      // Names and outcomes only. No arguments, no returned rows, no prompt —
      // enough to see which tools a question used and where it stopped,
      // without putting a shop's figures or a customer's name in a log.
      onEvent: (event) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[ai:agent] ${event.type}${event.tool ? ` ${event.tool}` : ""}`);
        }
      },
    });

    // `text/plain`, not JSON, and for a reason worth writing down: the
    // existing provider assistant UI (`FloatingChatWidget` +
    // `useStreamingChat`) reads a text/plain body, and it already handles the
    // loading state, the error codes, the stop button and the retry. Matching
    // that contract meant the whole owner copilot UI was an endpoint swap
    // rather than a second chat component to keep in step with the first.
    //
    // It is one chunk rather than token-by-token — the tool phase has to
    // finish before there is an answer to send (see the note at the top) — and
    // the hook is happy with that, because a single chunk is just a short
    // stream.
    //
    // The diagnostics ride along as headers: names and an outcome, never
    // arguments or rows.
    return new Response(result.text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Ai-Stop-Reason": result.stopReason,
        "X-Ai-Tools-Used": result.toolsUsed.join(",") || "none",
      },
    });
  } catch {
    // The loop handles model and tool failures itself and returns a friendly
    // result, so reaching here means something genuinely unexpected. The owner
    // gets a code the UI already knows; nothing internal is echoed back.
    return NextResponse.json({ error: "AGENT_FAILED" }, { status: 500 });
  }
}

/** Our message shape → the SDK's blocks. */
function toSdkMessage(message: AgentMessage) {
  if (message.toolResults?.length) {
    return {
      role: "user" as const,
      content: message.toolResults.map((result) => ({
        type: "tool_result" as const,
        tool_use_id: result.id,
        content: result.content,
        is_error: result.isError,
      })),
    };
  }

  if (message.toolCalls?.length) {
    return {
      role: "assistant" as const,
      content: [
        ...(message.content ? [{ type: "text" as const, text: message.content }] : []),
        ...message.toolCalls.map((call) => ({
          type: "tool_use" as const,
          id: call.id,
          name: call.name,
          input: call.input,
        })),
      ],
    };
  }

  return { role: message.role, content: message.content };
}
