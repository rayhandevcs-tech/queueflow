import "server-only";
import { findTool, toolSpecsForRole } from "./tool-registry";
import { fenceToolError, fenceToolResult, safeToolErrorMessage } from "./security";
import { ToolArgumentError } from "./tools/owner-analytics";
import type {
  AgentMessage,
  AgentResult,
  AgentRole,
  CallModel,
  ToolContext,
} from "./types";

/**
 * The bounded tool loop.
 *
 * ---------------------------------------------------------------------------
 * Every limit here exists because of a specific failure
 * ---------------------------------------------------------------------------
 * A tool loop is the one place in this product where a single HTTP request can
 * spend unbounded money. The model decides whether to call another tool, and
 * the thing it is deciding from includes text written by the public. So the
 * caps are not tuning parameters — they are the difference between a feature
 * and a liability:
 *
 *   MAX_ITERATIONS   a model that keeps asking for one more tool, forever
 *   MAX_TOOL_CALLS   a model that asks for forty tools in one turn
 *   MAX_CALLS_PER_TURN  the same, in a single response
 *
 * When a cap is hit the loop stops and says so. It does not quietly return a
 * partial answer as though it were complete, because an owner acting on half
 * an answer is worse off than one told the question was too big.
 *
 * ---------------------------------------------------------------------------
 * The model is injected, and that is the testability story
 * ---------------------------------------------------------------------------
 * `callModel` arrives as an argument rather than being imported. The route
 * passes an Anthropic-backed implementation; tests pass scripted turns. So the
 * registry lookup, the zod validation, the fencing, the caps and the error
 * mapping are all exercised with no API key and no network — which matters
 * because the key for this deployment does not exist yet.
 */

/** Model turns. Four is enough for "fetch two ranges, compare, answer". */
export const MAX_ITERATIONS = 4;
/** Total tools across the whole request. */
export const MAX_TOOL_CALLS = 8;
/** Tools in one model response, so a single turn cannot fan out. */
export const MAX_CALLS_PER_TURN = 4;

/** What the owner is told when a cap stops the loop. Bangla, like the rest. */
const LIMIT_MESSAGE =
  "প্রশ্নটা একবারে বের করার জন্য অনেক বড় হয়ে গেছে — একটু ছোট করে, বা একটা সময়ের কথা জিজ্ঞেস করলে ঠিকঠাক উত্তর দিতে পারব।";
const MODEL_ERROR_MESSAGE =
  "উত্তর তৈরি করতে গিয়ে সমস্যা হয়েছে। আরেকবার চেষ্টা করো।";

export async function runAgentLoop(input: {
  role: AgentRole;
  system: string;
  /** The conversation so far, oldest first. */
  messages: AgentMessage[];
  ctx: ToolContext;
  callModel: CallModel;
  /** Server-side diagnostics. Never given arguments or returned rows. */
  onEvent?: (event: { type: string; tool?: string; detail?: string }) => void;
}): Promise<AgentResult> {
  const { role, system, ctx, callModel, onEvent } = input;
  const messages: AgentMessage[] = [...input.messages];
  const specs = toolSpecsForRole(role);

  const toolsUsed: string[] = [];
  let totalToolCalls = 0;
  let iterations = 0;
  let lastText = "";

  while (iterations < MAX_ITERATIONS) {
    iterations += 1;

    let turn;
    try {
      turn = await callModel({ system, messages, tools: specs });
    } catch (err) {
      // A provider failure is not the owner's problem to read. The detail goes
      // to the log; they get a sentence and a retry.
      onEvent?.({
        type: "model_error",
        detail: err instanceof Error ? err.message : "unknown",
      });
      return {
        text: lastText || MODEL_ERROR_MESSAGE,
        stopReason: "model_error",
        toolsUsed,
        iterations,
      };
    }

    if (turn.text) lastText = turn.text;

    // Nothing more wanted: this is the answer.
    if (!turn.wantsTools || turn.toolCalls.length === 0) {
      return { text: turn.text || lastText, stopReason: "answered", toolsUsed, iterations };
    }

    if (turn.toolCalls.length > MAX_CALLS_PER_TURN) {
      onEvent?.({ type: "tool_fanout_blocked", detail: String(turn.toolCalls.length) });
      return { text: LIMIT_MESSAGE, stopReason: "tool_call_limit", toolsUsed, iterations };
    }
    if (totalToolCalls + turn.toolCalls.length > MAX_TOOL_CALLS) {
      onEvent?.({ type: "tool_call_limit" });
      return { text: LIMIT_MESSAGE, stopReason: "tool_call_limit", toolsUsed, iterations };
    }

    // Replay the assistant's request, then answer it. Both halves are needed
    // or the next turn has no idea what it asked for.
    messages.push({ role: "assistant", content: turn.text, toolCalls: turn.toolCalls });

    const results: AgentMessage["toolResults"] = [];
    for (const call of turn.toolCalls) {
      totalToolCalls += 1;
      results.push(await executeToolCall({ role, call, ctx, onEvent }));
    }
    messages.push({ role: "user", content: "", toolResults: results });
  }

  // Out of iterations with the model still asking for tools.
  onEvent?.({ type: "iteration_limit" });
  return { text: LIMIT_MESSAGE, stopReason: "iteration_limit", toolsUsed, iterations };

  async function executeToolCall(args: {
    role: AgentRole;
    call: { id: string; name: string; input: unknown };
    ctx: ToolContext;
    onEvent?: (event: { type: string; tool?: string; detail?: string }) => void;
  }): Promise<{ id: string; content: string; isError: boolean }> {
    const { call } = args;

    // 1. Is it a tool at all, for this role? An unknown name and a name that
    //    belongs to another role are answered identically on purpose — see
    //    `findTool`. The model is told it does not exist, not that it is
    //    forbidden, so there is nothing to probe for.
    const tool = findTool(args.role, call.name);
    if (!tool) {
      args.onEvent?.({ type: "unknown_tool", tool: call.name });
      return {
        id: call.id,
        content: fenceToolError(
          call.name,
          "NO_SUCH_TOOL — that tool does not exist. Use only the tools you were given.",
        ),
        isError: true,
      };
    }

    // 2. Is it allowed to write? Nothing in Sprint 1 is, and the loop is the
    //    place that says no. A mutation tool added later cannot be reached by
    //    the model until somebody deliberately builds the confirmation path
    //    and changes this check — which is the point.
    if (!tool.readOnly) {
      args.onEvent?.({ type: "mutation_blocked", tool: tool.name });
      return {
        id: call.id,
        content: fenceToolError(
          tool.name,
          "NOT_PERMITTED — this assistant cannot change anything. Explain what the owner should do instead.",
        ),
        isError: true,
      };
    }

    // 3. Do the arguments hold up? The model produces JSON that merely looks
    //    plausible; zod is what makes it true. A failure returns the issues so
    //    the model can correct itself on the next iteration instead of the
    //    request dying.
    const parsed = tool.schema.safeParse(call.input ?? {});
    if (!parsed.success) {
      args.onEvent?.({ type: "bad_arguments", tool: tool.name });
      const issues = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      return {
        id: call.id,
        content: fenceToolError(tool.name, `INVALID_ARGUMENTS — ${issues}`),
        isError: true,
      };
    }

    // 4. Run it.
    try {
      const payload = await tool.handler(parsed.data, args.ctx);
      toolsUsed.push(tool.name);
      args.onEvent?.({ type: "tool_ok", tool: tool.name });
      return { id: call.id, content: fenceToolResult(tool.name, payload), isError: false };
    } catch (err) {
      // An argument problem the schema could not catch — a reversed range, a
      // window wider than analytics covers — is worth passing back in full,
      // because the model can fix it. Anything else is reduced to a code by
      // `safeToolErrorMessage`, so no SQL, table name or constraint reaches
      // the model or the owner.
      const message =
        err instanceof ToolArgumentError ? err.message : safeToolErrorMessage(err);
      args.onEvent?.({
        type: "tool_error",
        tool: tool.name,
        detail: err instanceof Error ? err.message : "unknown",
      });
      return { id: call.id, content: fenceToolError(tool.name, message), isError: true };
    }
  }
}
