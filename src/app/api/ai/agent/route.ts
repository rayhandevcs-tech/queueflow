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
import type { AgentMessage, AgentRole, CallModel, ModelTurn } from "@/lib/ai/types";
import { OWNER_COPILOT_SYSTEM } from "@/features/provider-ai/lib/prompt";
import {
  CUSTOMER_DISCOVERY_SYSTEM,
  customerPreferenceAsPrompt,
} from "@/features/customer-help/lib/prompt";
import { parsePreference } from "@/lib/customer-preference";

/**
 * The agent endpoint — one endpoint, two roles.
 *
 * A shopkeeper gets the analytics copilot; everyone else gets the customer
 * discovery assistant. Deliberately the same route rather than
 * `/api/ai/agent/customer` alongside it: the loop, the caps, the fencing, the
 * tool-result handling and the response contract are identical, and the only
 * things that actually differ are three values decided before the loop starts —
 * which registry slice, which system prompt, which model. A second route would
 * have duplicated the parts that matter for security in order to vary the parts
 * that do not, and the duplicate is where the next fix gets forgotten.
 *
 * ---------------------------------------------------------------------------
 * The order of operations is the security model
 * ---------------------------------------------------------------------------
 * Identity is resolved BEFORE the model is given a single token, and it is
 * resolved from the session cookie:
 *
 *   1. `auth.getUser()` — who is this really
 *   2. do they own a shop — which decides the role, and which shop's figures
 *      may be read
 *   3. only then does the model get asked anything
 *
 * The role is a fact about the database, not a field in the request. There is
 * nothing to send that would make a customer an owner, and the tools take no
 * identity arguments at all — `get_customer_history` has no `customer_id`
 * parameter, so the model cannot name anybody, and the owner tools read
 * `ctx.shopId`, which is null for a customer.
 *
 * Everything downstream then uses the cookie-bound client, which means RLS is
 * live on every query, `analytics_scope` re-checks `is_shop_owner` inside each
 * analytics RPC, and the `serials` policy re-checks the customer on their own
 * history. The service-role client is deliberately absent from this whole
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

  // The role is DERIVED, never claimed.
  //
  // Nothing in the request body says which role the caller wants, and adding
  // such a field would be the whole vulnerability: a customer posting
  // `{"role":"owner"}` would be handed the analytics registry. Instead the
  // question asked is "does a shop row exist whose owner_id is this uuid" —
  // a database fact about the authenticated session, checked under RLS.
  //
  // So `role` below is not a preference. It is the answer to a query, and
  // there is no code path by which a model, a prompt or a body field can
  // change it. Note what is NOT consulted: `user_metadata.role`, which the
  // middleware uses to pick a UI shell. That claim is writable by the account
  // holder via `auth.updateUser()` — its own comment says so — and it gates
  // which screens render, nothing more. Reading it here would make "which
  // tools may I call" a self-declared field.
  //
  // One consequence, chosen rather than tolerated: a provider account that
  // has not created its shop yet is "customer" here, and gets the discovery
  // assistant inside the provider shell. That is the accurate answer — with
  // no shop there are no figures to analyse — and it is friendlier than the
  // 403 this route used to return, which told a new shopkeeper nothing.
  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  const role: AgentRole = shop ? "owner" : "customer";

  // Everything role-dependent is resolved here, once, before the model exists.
  // `shopId` is null for a customer, which is the second gate the owner tools
  // hit (`requireShop` raises SHOP_REQUIRED) if role scoping were ever wrong —
  // and `analytics_scope` in the RPC is the third.
  const shopId = shop?.id ?? null;

  let system: string;
  let model: string;

  if (role === "owner") {
    system = OWNER_COPILOT_SYSTEM;
    model = AI_MODELS.ownerCopilot;
  } else {
    // The preference is read here rather than accepted as an argument, for the
    // same reason the role is. It is appended to the system prompt as a
    // tie-breaker for unqualified questions and is NOT passed to any tool, so
    // it cannot narrow what the customer is able to find.
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferred_business_type")
      .eq("id", user.id)
      .maybeSingle();

    system = `${CUSTOMER_DISCOVERY_SYSTEM}\n\n${customerPreferenceAsPrompt(
      parsePreference(profile?.preferred_business_type),
    )}`;
    model = AI_MODELS.customerAgent;
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
      model,
      max_tokens: AI_MAX_TOKENS.copilot,
      system: [
        { type: "text", text: system, cache_control: { type: "ephemeral" } },
        { type: "text", text: `Today in Bangladesh is ${dhakaToday(now)}.` },
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
      role,
      system,
      messages: parsed.data.messages.map((m) => ({ role: m.role, content: m.content })),
      ctx: { supabase, userId: user.id, shopId, now },
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
