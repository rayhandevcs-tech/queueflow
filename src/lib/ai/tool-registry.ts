import "server-only";
import { z } from "zod";
import type { AgentRole, ToolDefinition } from "./types";
import { OWNER_ANALYTICS_TOOLS } from "./tools/owner-analytics";
import { CUSTOMER_DISCOVERY_TOOLS } from "./tools/customer-discovery";
import { JOIN_QUEUE_TOOLS } from "./tools/join-queue-prepare";
import { APPOINTMENT_TOOLS } from "./tools/appointment-prepare";
import { REWARD_TOOLS } from "./tools/reward-prepare";

/**
 * The complete, closed list of things the model may do.
 *
 * "Closed" is the entire design. There is no `run_query`, no `execute`, no
 * `call_function`, no tool that takes SQL, a table name, an endpoint or a
 * function name as an argument. The model cannot reach a capability by naming
 * it; it can only reach one that appears in this array, with arguments that
 * survive that tool's zod schema.
 *
 * Why it matters more than it sounds: the usual way an AI feature becomes a
 * security incident is a well-meaning generic tool — "query the database,
 * here's the schema" — added because it saves writing eleven adapters. It also
 * hands the model, and therefore anyone who can type into the chat box, the
 * ability to select any row the connection can see. Eleven adapters is the
 * cheaper option.
 *
 * Adding a tool here is the only way to widen what the AI can do, which makes
 * this file the one place to review when asking "what can the assistant
 * actually touch?".
 */
const ALL_TOOLS: readonly ToolDefinition[] = [
  ...OWNER_ANALYTICS_TOOLS,
  ...CUSTOMER_DISCOVERY_TOOLS,
  // Sprint 3's `prepare_join_queue`. It is in this list and it is read-only,
  // which is the whole shape of that sprint: the model can ask for a queue
  // join to be PREPARED, and the join itself happens in
  // `/api/ai/actions/confirm` after the customer presses a button — outside
  // the loop, outside the registry, and outside anything a model can call.
  ...JOIN_QUEUE_TOOLS,
  // Sprint 4's two, on exactly the same terms. `prepare_book_appointment` and
  // `prepare_redeem_reward` write nothing: they validate, read real figures and
  // leave a draft. `book_appointment()` and `redeem_reward()` — the app's own
  // business functions, unchanged — are called by the confirm endpoint, which
  // has no model in its request at all.
  ...APPOINTMENT_TOOLS,
  ...REWARD_TOOLS,
];

/**
 * **Every tool in the registry is read-only, and still is after Sprint 4.**
 *
 * Checked at import time rather than left as a claim in a document, and it has
 * now survived three sprints that added a mutation each — because none of those
 * mutations was built as a tool. The generic loop still refuses
 * `readOnly: false` (see `agent-readonly.test.ts`, which proves the refusal by
 * mocking a writable tool in front of it), and nothing about the three
 * confirmed-action paths required relaxing either guard.
 *
 * If a future sprint does need a write tool, this is the line that has to
 * change, and changing it will be a visible, reviewable diff next to a
 * confirmation path that had better already exist.
 */
for (const tool of ALL_TOOLS) {
  if (!tool.readOnly) {
    throw new Error(
      `Tool ${tool.name} is not read-only. The agent loop refuses write tools; ` +
        `a mutation belongs behind the confirmed-action endpoint, not in the registry.`,
    );
  }
}

/** Fail loudly at import time rather than mysteriously at request time. */
const seen = new Set<string>();
for (const tool of ALL_TOOLS) {
  if (seen.has(tool.name)) {
    throw new Error(`Duplicate AI tool name: ${tool.name}`);
  }
  seen.add(tool.name);
}

/**
 * The tools one role may see.
 *
 * Role scoping is a second gate, not the only one. A customer cannot see
 * `get_revenue_trend` here, and even if they somehow named it, the tool would
 * find `shopId: null` on its context and refuse — and even if it did not, the
 * RPC's own `analytics_scope` would raise `not your shop`. Three independent
 * layers, because the interesting failures are the ones where the first two
 * were bypassed.
 */
export function toolsForRole(role: AgentRole): readonly ToolDefinition[] {
  return ALL_TOOLS.filter((tool) => tool.roles.includes(role));
}

/**
 * Look up a tool the model asked for, scoped to the caller's role.
 *
 * Returns `null` for a name that does not exist AND for a name that exists but
 * belongs to another role — the caller cannot tell those apart, which is
 * deliberate. "There is no such tool" is a better answer than "there is, but
 * not for you", which is an invitation to keep guessing.
 */
export function findTool(role: AgentRole, name: string): ToolDefinition | null {
  return toolsForRole(role).find((tool) => tool.name === name) ?? null;
}

/**
 * The registry as the Anthropic API wants it.
 *
 * Schemas are generated from the zod definitions rather than hand-written as
 * JSON Schema, so the shape the model is told about and the shape that is
 * validated cannot drift. A hand-maintained duplicate would drift on the first
 * argument anybody added.
 */
export function toolSpecsForRole(
  role: AgentRole,
): Array<{ name: string; description: string; input_schema: unknown }> {
  return toolsForRole(role).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: z.toJSONSchema(tool.schema, { io: "input" }),
  }));
}

/** Exported for the tests that assert the registry's invariants. */
export const REGISTRY_TOOL_NAMES: readonly string[] = ALL_TOOLS.map((t) => t.name);
export { ALL_TOOLS as __ALL_TOOLS_FOR_TESTS };
