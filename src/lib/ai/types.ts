import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { Database } from "@/types/database.types";

/**
 * Shared types for the AI agent layer.
 *
 * `server-only` at the top, like `@/lib/anthropic/client`: nothing in here may
 * end up in a browser bundle. A tool handler holds a Supabase client and runs
 * privileged-ish reads; a client component importing this file should be a
 * build error rather than a thing somebody notices in review.
 */

/**
 * Which app the caller is in. Not a permission by itself — it selects which
 * slice of the registry is even visible, and the tools then do their own
 * authorization on top.
 */
export type AgentRole = "owner" | "customer";

/**
 * What a tool handler is handed.
 *
 * The important thing here is what is ABSENT: there is no way for a tool to
 * receive an identity from the model. `userId` comes from `auth.getUser()` and
 * `shopId` from the shop that user owns, both resolved once in the route
 * before the model has said anything. A tool cannot ask for a different one,
 * because there is no argument through which to ask.
 */
export interface ToolContext {
  /** Cookie-bound client. RLS applies to every query a tool makes. */
  supabase: SupabaseClient<Database>;
  /** From `auth.getUser()`. Never from the model. */
  userId: string;
  /**
   * The shop this session owns, for owner tools. `null` for a customer
   * session, which is why owner tools are not in a customer's registry slice.
   */
  shopId: string | null;
  /** Server "now", so a tool can resolve "this week" without asking the model. */
  now: Date;
  /**
   * What THIS request's tools have actually returned, and the action draft they
   * produced. Present for a customer request in AI Sprint 3; absent for the
   * owner copilot, which proposes nothing.
   *
   * Typed loosely here on purpose. `proposals.ts` imports `security.ts` and
   * nothing else, and importing `DiscoveryLedger` into this file would put a
   * class in the module every tool already depends on. The customer tools
   * narrow it where they use it.
   *
   * Notice what is NOT on this context, in Sprint 3 as in Sprint 2: no
   * customer id a tool could be pointed at, no shop the model chose, and no
   * stored preference. `userId` is from `auth.getUser()` and stays that way.
   */
  discovery?: DiscoveryLedgerLike;
}

/**
 * The ledger's surface as the tools use it — offer ids, require ids, leave a
 * draft. The implementation is `DiscoveryLedger` in `proposals.ts`.
 */
export interface DiscoveryLedgerLike {
  offer(kind: "shop" | "service", ids: readonly string[]): void;
  has(kind: "shop" | "service", id: string): boolean;
  requireOffered(kind: "shop" | "service", ids: readonly string[]): void;
  draft: unknown;
}

/**
 * A tool the model is allowed to call.
 *
 * `readOnly` is not documentation. The loop refuses to execute a tool that has
 * not set it to `true`, which means a future mutation tool cannot be reached
 * by accident: adding one requires going to the loop and building the
 * confirmation path deliberately (see `proposals.ts`).
 */
export interface ToolDefinition<S extends z.ZodType = z.ZodType> {
  name: string;
  /** Shown to the model. Say what it returns AND what it cannot do. */
  description: string;
  schema: S;
  /**
   * `false` marks a tool that writes. Nothing in Sprint 1 sets it, and the
   * loop will not run one — the field exists so that the day a write tool is
   * added, its risk is declared in the registry rather than discovered.
   */
  readOnly: boolean;
  /** Which app may see this tool at all. */
  roles: readonly AgentRole[];
  handler: (args: z.infer<S>, ctx: ToolContext) => Promise<unknown>;
}

/** What the loop gets back from one model turn, whoever produced it. */
export interface ModelTurn {
  /** Text the model wants to say. Empty while it is only calling tools. */
  text: string;
  /** Tool calls it wants run before it continues. */
  toolCalls: Array<{ id: string; name: string; input: unknown }>;
  /** True when the model stopped because it wants tool results back. */
  wantsTools: boolean;
}

/**
 * How the loop talks to a model — injected rather than imported.
 *
 * This single indirection is what makes the whole agent testable with no API
 * key and no network: a test supplies a `CallModel` that returns scripted
 * turns, and the loop, the registry, the validation and the fencing are all
 * exercised for real. The Anthropic-backed implementation lives in the route.
 */
export type CallModel = (input: {
  system: string;
  messages: AgentMessage[];
  tools: Array<{ name: string; description: string; input_schema: unknown }>;
}) => Promise<ModelTurn>;

/**
 * A turn in the conversation as the loop tracks it.
 *
 * Deliberately our own shape rather than the SDK's: the loop should not need
 * rewriting when a provider changes its block types, and a test should be able
 * to build one of these without importing an SDK at all.
 */
export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
  /** Set on an assistant turn that asked for tools, to replay it faithfully. */
  toolCalls?: Array<{ id: string; name: string; input: unknown }>;
  /** Set on a user turn that carries results back. */
  toolResults?: Array<{ id: string; content: string; isError: boolean }>;
}

/** Why the loop stopped. Surfaced for diagnostics, not shown raw to anyone. */
export type AgentStopReason =
  | "answered"
  | "iteration_limit"
  | "tool_call_limit"
  | "model_error";

export interface AgentResult {
  /** The answer, or a friendly sentence if it could not finish. */
  text: string;
  stopReason: AgentStopReason;
  /** Names only, for logging. Never the arguments or the returned rows. */
  toolsUsed: string[];
  iterations: number;
}
