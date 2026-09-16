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
import type { Json } from "@/types/database.types";
import {
  AI_ACTION_BOOK_APPOINTMENT,
  AI_ACTION_JOIN_QUEUE,
  AI_ACTION_REDEEM_REWARD,
  DiscoveryLedger,
  newProposalNonce,
  ttlForAction,
  type AiProposalDraft,
} from "@/lib/ai/proposals";

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
   * What this request's tools actually returned.
   *
   * Built here, per request, and handed to the loop on the context. Two things
   * follow from its lifetime being one request:
   *
   *   · `prepare_join_queue` can only propose ids that a search tool returned
   *     during THIS request, so a remembered or invented id is refused;
   *   · nothing survives to be replayed, because the chat history posted on
   *     each turn carries user and assistant TEXT only — never tool results.
   *
   * Owners get no ledger. They have nothing to propose, and omitting it means
   * `prepare_join_queue` would refuse even if role scoping were somehow wrong.
   */
  const ledger = role === "customer" ? new DiscoveryLedger() : undefined;

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
      ctx: { supabase, userId: user.id, shopId, now, discovery: ledger },
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
    //
    // And, from Sprint 3, the id of a proposal if the turn produced one. Only
    // the id: the card fetches the row itself from `ai_actions` under RLS, so
    // what it displays is what the server stored rather than a payload that
    // passed through the client on its way to a confirm button.
    const proposalId = await persistProposal(supabase, ledger?.draft ?? null);

    return new Response(result.text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Ai-Stop-Reason": result.stopReason,
        "X-Ai-Tools-Used": result.toolsUsed.join(",") || "none",
        ...(proposalId ? { "X-Ai-Proposal-Id": proposalId } : {}),
      },
    });
  } catch {
    // The loop handles model and tool failures itself and returns a friendly
    // result, so reaching here means something genuinely unexpected. The owner
    // gets a code the UI already knows; nothing internal is echoed back.
    return NextResponse.json({ error: "AGENT_FAILED" }, { status: 500 });
  }
}

/**
 * Turn a draft into a PROPOSED row, or do nothing.
 *
 * ---------------------------------------------------------------------------
 * Why this is here and not in the tool
 * ---------------------------------------------------------------------------
 * Every `prepare_*` tool is read-only and must stay that way: the agent loop
 * refuses a tool that declares otherwise, and that refusal is what Sprints 1
 * and 2 rest on. So the tools validate and assemble, and the write happens
 * here — after the loop has finished, in code the model cannot call, whose
 * arguments it cannot influence, and whose result it never sees.
 *
 * The consequence is worth stating plainly: there is no sequence of model
 * outputs that creates a proposal with figures the model chose. The draft it
 * left came from `services.rate`, `services.default_duration_min`,
 * `queue_public`, `shop_available_slots()`, `rewards` and `loyalty_accounts`;
 * the nonce is generated here; `user_id` and `expires_at` are stamped by the
 * database from `auth.uid()` and `now()`.
 *
 * ---------------------------------------------------------------------------
 * Three action types, one function, and the switch is exhaustive
 * ---------------------------------------------------------------------------
 * The `action` discriminant decides which arguments are sent, and the `default`
 * refuses anything else — so a draft shape this function does not recognise
 * produces no proposal rather than a half-filled row. `ai_action_propose` then
 * checks the same shape rules again, and `ai_actions_params_match_type` checks
 * them a third time in the table itself.
 *
 * A failure to persist is swallowed to a null. The customer then gets the
 * assistant's text with no card, which reads as "it described something but
 * did not offer a button" — mildly confusing, and much better than a 500 that
 * throws away a perfectly good answer. Nothing was written, so nothing is
 * half-done.
 */
async function persistProposal(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  draft: unknown,
): Promise<string | null> {
  if (!draft || typeof draft !== "object") return null;
  const proposal = draft as AiProposalDraft;

  // The arguments beyond the shared six, per type. Assembled here so the RPC
  // call below is one statement and the per-type shape is one object — and so
  // that a type with no case produces nothing at all.
  //
  // `p_display` is cast to the generated `Json` type. A draft is a plain object
  // of strings, numbers, nulls and arrays by construction — nothing in the
  // union fails to serialise — but the structural type does not know that, and
  // widening `Json` to accommodate it would weaken it everywhere else.
  let args: {
    p_service_ids: string[];
    p_staff_id: string | null;
    p_starts_at: string | null;
    p_reward_id: string | null;
  };

  switch (proposal.action) {
    case AI_ACTION_JOIN_QUEUE:
      if (proposal.services.length === 0) return null;
      args = {
        p_service_ids: proposal.services.map((service) => service.serviceId),
        p_staff_id: null,
        p_starts_at: null,
        p_reward_id: null,
      };
      break;

    case AI_ACTION_BOOK_APPOINTMENT:
      if (proposal.services.length === 0) return null;
      args = {
        p_service_ids: proposal.services.map((service) => service.serviceId),
        // The slot, exactly as the availability engine gave it. These two are
        // what the confirm endpoint revalidates from — they are not on the
        // card for decoration.
        p_staff_id: proposal.staffId,
        p_starts_at: proposal.startsAt,
        p_reward_id: null,
      };
      break;

    case AI_ACTION_REDEEM_REWARD:
      args = {
        // Empty on purpose: points buy a coupon, not a service. The table's
        // `ai_actions_params_match_type` requires it to be empty for this type.
        p_service_ids: [],
        p_staff_id: null,
        p_starts_at: null,
        p_reward_id: proposal.rewardId,
      };
      break;

    default:
      return null;
  }

  const { data, error } = await supabase.rpc("ai_action_propose", {
    p_action_type: proposal.action,
    p_shop_id: proposal.shopId,
    p_nonce: newProposalNonce(),
    // The figures the customer is about to be shown, frozen. For a queue join
    // this is NOT what they are charged — `serial_before_insert` prices the
    // booking from `services.rate` at insert time. For an appointment and a
    // redemption it is also the comparison the confirm endpoint makes, so a
    // price or a points cost that moved is refused rather than applied
    // silently. Either way the column answers "what were they looking at when
    // they agreed?".
    p_display: proposal as unknown as Json,
    // Shorter for the two Sprint 4 actions, because a slot is contended and a
    // balance moves. `ttlForAction` is the single place that decides.
    p_ttl_seconds: ttlForAction(proposal.action),
    ...args,
  });

  if (error || !data) return null;
  return (data as { id?: string }).id ?? null;
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
