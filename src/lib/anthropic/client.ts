import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** Thrown when the deployment has no Anthropic key configured. */
export const ANTHROPIC_KEY_MISSING = "ANTHROPIC_KEY_MISSING";

/**
 * Which model each AI feature runs on.
 *
 * It began as one constant for every route, and the reasoning was sound: a
 * model name per file is a model name somebody forgets to change. What that
 * missed is that the tasks are not alike. Extracting "সাদিয়াকে দুই নম্বর
 * চেয়ারে বসাও" into a small JSON object and investigating why a shop's
 * revenue moved are not the same problem, and paying the same per-token rate
 * for both is a choice rather than a default.
 *
 * So: still one place, now with one entry per purpose. Each is overridable by
 * environment variable so a deployment can move a single feature without a
 * release, and each falls back to a real model id that exists today — no
 * invented names.
 */
const DEFAULT_MODEL = "claude-opus-5";
/**
 * Cheap and quick. Suits extraction and short help-desk answers.
 *
 * Was `claude-haiku-4-5-20251001`. The canonical id carries no date suffix,
 * and while nothing routed here the stale form was harmless; the customer
 * agent routes here now, so it had to be right.
 */
const FAST_MODEL = "claude-haiku-4-5";

export const AI_MODELS = {
  /**
   * The owner copilot. Reasoning over several tool results and comparing two
   * periods is the one job here that genuinely benefits from the strong model,
   * and a wrong number costs a shopkeeper real money.
   */
  ownerCopilot: process.env.AI_MODEL_OWNER_COPILOT || DEFAULT_MODEL,
  /**
   * The customer discovery agent — **now on `FAST_MODEL`**, which is the switch
   * this entry was created to hold.
   *
   * The job was always closer to a help desk than to revenue analysis: pick a
   * tool, read back what it returned, and resist inventing a price. None of
   * that repays a frontier model, and the cost of using one was latency a
   * customer actually waits through — a shopper asking "আজ চুল কাটাতে চাই"
   * wants a list of shops, not a considered essay.
   *
   * What makes this safe to move is that none of the guarantees live in the
   * model. The ids are checked against the discovery ledger, the prices come
   * off the shop's own rows, and a mutation still needs a proposal and a human
   * click. A weaker model produces a worse *sentence*, never a worse *write*.
   *
   * Set `AI_MODEL_CUSTOMER_AGENT` to move it back without a release.
   */
  customerAgent: process.env.AI_MODEL_CUSTOMER_AGENT || FAST_MODEL,
  /** The pre-tool provider analyst and one-shot insights. */
  shopAnalyst: process.env.AI_MODEL_SHOP_ANALYST || DEFAULT_MODEL,
  /** Customer help desk: short answers from a small brief. */
  help: process.env.AI_MODEL_HELP || DEFAULT_MODEL,
  /** Voice → structured intent. Extraction, not reasoning. */
  intent: process.env.AI_MODEL_INTENT || DEFAULT_MODEL,
  /** Style advice and shop-setup suggestions. */
  suggest: process.env.AI_MODEL_SUGGEST || DEFAULT_MODEL,
} as const;

/**
 * The original single constant, kept so the five existing routes did not all
 * have to change in the same commit as the agent work.
 *
 * Every default above is still this value, so **nothing has moved model yet** —
 * this sprint put the switch in place without flipping it. Routing a route to
 * `FAST_MODEL` is a decision with quality consequences and it deserves its own
 * change, where the effect can be looked at rather than bundled in.
 *
 * @deprecated Prefer `AI_MODELS.<purpose>`.
 */
export const AI_MODEL = DEFAULT_MODEL;

/** Exported so a future routing change has the id to hand. */
export const AI_FAST_MODEL = FAST_MODEL;

/**
 * Output ceilings, per purpose.
 *
 * `chat` was on 64000. Nobody reads sixty-four thousand tokens of Bangla, and
 * with adaptive thinking on the strong model that ceiling is also a licence to
 * spend a long time before saying anything. A business answer is a few
 * paragraphs; 2000 is generous for one.
 */
export const AI_MAX_TOKENS = {
  /** A few paragraphs of analysis, with room for a short table. */
  copilot: 2000,
  /** Help-desk replies are two or three sentences by instruction. */
  help: 1200,
  /** A small structured object. */
  intent: 2000,
} as const;

/**
 * How hard a feature should think, per purpose.
 *
 * On Claude Opus 5 the default is `high` with thinking on, and for a question
 * like "what could explain last week's dip" that is the right default — it is
 * reasoning across two tool results. For everything else it is latency the
 * user sits through for no better answer.
 */
export type AiEffort = "low" | "medium" | "high";

/**
 * Speed knobs for one model, as request parameters.
 *
 * ---------------------------------------------------------------------------
 * Why this is a function of the model and not a constant
 * ---------------------------------------------------------------------------
 * The two families take different parameters, and sending the wrong ones is a
 * 400 rather than something degrading quietly:
 *
 *   · Opus 5 has adaptive thinking (on by default) and accepts
 *     `output_config.effort`.
 *   · Haiku 4.5 has neither. `effort` is rejected, and `thinking` only takes
 *     the older `{type:"enabled", budget_tokens}` shape.
 *
 * Since every model here is overridable by environment variable, a route that
 * hard-coded `effort` would start failing the moment someone pointed it at
 * Haiku — which is exactly the move an operator makes when they want it
 * faster. So the decision lives next to the model table that can change, and
 * the routes ask rather than assume.
 *
 * Thinking is deliberately NOT disabled on Opus for the agent route. With
 * `thinking: {type:"disabled"}` the model occasionally writes a tool call into
 * its visible text instead of making one: the turn succeeds, the call never
 * runs, and nothing raises. Lower effort buys the same latency back without
 * that failure mode.
 */
export function speedParamsFor(model: string, effort: AiEffort) {
  if (model.startsWith("claude-haiku")) {
    // No thinking at all, which is the whole reason to be on this model.
    return {};
  }
  return {
    thinking: { type: "adaptive" as const },
    output_config: { effort },
  };
}

/**
 * Server-only Claude client.
 *
 * `server-only` at the top is the real guard: importing this from a client
 * component is a build error, not a runtime surprise. That matters more here
 * than anywhere else in the project — an API key that reaches a browser bundle
 * is a key someone else can spend, and unlike a leaked Supabase anon key there
 * is no RLS behind it to limit the damage.
 *
 * The key is checked rather than asserted with `!`, for the same reason
 * getServiceRoleClient() checks: a deployment that simply forgot the variable
 * should say so, instead of failing somewhere inside the SDK and surfacing as
 * a bare 500 that looks like an outage.
 */
export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error(ANTHROPIC_KEY_MISSING);

  return new Anthropic({ apiKey });
}
