import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** Thrown when the deployment has no Anthropic key configured. */
export const ANTHROPIC_KEY_MISSING = "ANTHROPIC_KEY_MISSING";

/**
 * The model every AI feature in this project runs on.
 *
 * One constant rather than a string per route: when the model changes it
 * changes everywhere at once, and nobody has to remember which screen was
 * pinned to what.
 */
export const AI_MODEL = "claude-opus-5";

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
