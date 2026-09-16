import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { ToolContext, ToolDefinition } from "./types";

/**
 * The read-only gate in the loop, tested by actually reaching it.
 *
 * ---------------------------------------------------------------------------
 * Why this needs its own file
 * ---------------------------------------------------------------------------
 * `agent-loop.ts` refuses any tool whose `readOnly` is false, before the
 * arguments are validated and before the handler is called. That branch is the
 * structural guarantee behind "Sprint 2 is read-only" — and until this file it
 * had never been executed by a test, because every tool in the registry is
 * read-only, so there was nothing to trip it.
 *
 * A guard that has never run once is a guard nobody has checked. The registry
 * is mocked here — and only here, which is why this is a separate file, since
 * `vi.mock` applies to a whole module graph — so that a deliberately writable
 * tool can be put in front of the loop and refused. The tool's handler sets a
 * flag; the test's real assertion is that the flag stayed false.
 *
 * This is also the test that will matter most in Sprint 3. When the first
 * mutation tool is added on purpose, this file is what proves the loop still
 * refuses it by default, and that reaching it requires the confirmation path
 * rather than just declaring a tool.
 */

let handlerRan = false;

const writableTool: ToolDefinition = {
  name: "join_queue",
  description: "Would join a queue. Exists only in this test.",
  readOnly: false,
  roles: ["customer"],
  schema: z.object({ shopId: z.string() }),
  handler: async () => {
    handlerRan = true;
    return { joined: true };
  },
};

const readableTool: ToolDefinition = {
  name: "search_shops",
  description: "A read-only control, so the mock is not the reason nothing ran.",
  readOnly: true,
  roles: ["customer"],
  schema: z.object({}),
  handler: async () => ({ shops: [] }),
};

vi.mock("./tool-registry", () => ({
  findTool: (role: string, name: string) =>
    [writableTool, readableTool].find(
      (tool) => tool.name === name && (tool.roles as readonly string[]).includes(role),
    ) ?? null,
  toolsForRole: () => [writableTool, readableTool],
  toolSpecsForRole: () => [
    { name: "join_queue", description: "w", input_schema: {} },
    { name: "search_shops", description: "r", input_schema: {} },
  ],
  REGISTRY_TOOL_NAMES: ["join_queue", "search_shops"],
  __ALL_TOOLS_FOR_TESTS: [writableTool, readableTool],
}));

const { runAgentLoop } = await import("./agent-loop");

const ctx = {
  supabase: {} as ToolContext["supabase"],
  userId: "customer-1",
  shopId: null,
  now: new Date("2026-09-16T12:00:00Z"),
} as ToolContext;

async function loopWith(name: string, input: unknown) {
  handlerRan = false;
  const seen: Array<{ toolResults?: Array<{ content: string; isError: boolean }> }> = [];
  let turn = 0;
  const events: string[] = [];

  const result = await runAgentLoop({
    role: "customer",
    system: "S",
    messages: [{ role: "user", content: "লাইনে ঢুকিয়ে দাও" }],
    ctx,
    callModel: async ({ messages }) => {
      seen.push({ toolResults: messages.at(-1)?.toolResults });
      return turn++ === 0
        ? { text: "", toolCalls: [{ id: "t1", name, input }], wantsTools: true }
        : { text: "ok", toolCalls: [], wantsTools: false };
    },
    onEvent: (event) => events.push(`${event.type}:${event.tool ?? ""}`),
  });

  return { result, handed: seen[1]?.toolResults?.[0], events };
}

describe("the loop refuses a tool that can write", () => {
  it("**a writable tool is refused with NOT_PERMITTED**", async () => {
    const { handed } = await loopWith("join_queue", { shopId: "shop-1" });
    expect(handed?.isError).toBe(true);
    expect(handed?.content).toContain("NOT_PERMITTED");
  });

  it("**and its handler never runs**", async () => {
    await loopWith("join_queue", { shopId: "shop-1" });
    expect(handlerRan).toBe(false);
  });

  it("**it is not counted as a tool the answer used**", async () => {
    const { result } = await loopWith("join_queue", { shopId: "shop-1" });
    expect(result.toolsUsed).toEqual([]);
    expect(result.stopReason).toBe("answered");
  });

  it("the refusal is reported as an event, so it is visible in diagnostics", async () => {
    const { events } = await loopWith("join_queue", { shopId: "shop-1" });
    expect(events).toContain("mutation_blocked:join_queue");
  });

  it("the write is refused BEFORE the arguments are validated", async () => {
    // Arguments that the schema would reject. If validation came first the
    // model would be told its arguments were wrong, which reads as "fix them
    // and try again" — an invitation to retry something that can never work.
    const { handed } = await loopWith("join_queue", { nonsense: true });
    expect(handed?.content).toContain("NOT_PERMITTED");
    expect(handed?.content).not.toContain("INVALID_ARGUMENTS");
    expect(handlerRan).toBe(false);
  });

  it("a read-only tool in the same mocked registry still runs", async () => {
    // The control. Without it, every assertion above would also pass if the
    // mock had simply broken tool execution altogether.
    const { result } = await loopWith("search_shops", {});
    expect(result.toolsUsed).toEqual(["search_shops"]);
  });
});
