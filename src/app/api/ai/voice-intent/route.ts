import { NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AI_MODEL, ANTHROPIC_KEY_MISSING, getAnthropicClient } from "@/lib/anthropic/client";
import { createServerSupabase } from "@/lib/supabase/server";
import { VoiceIntentSchema } from "@/features/provider-voice/lib/intent-schema";
import {
  voiceContextAsPrompt,
  VOICE_INTENT_SYSTEM,
} from "@/features/provider-voice/lib/prompt";

const BodySchema = z.object({
  transcript: z.string().min(2).max(500),
});

/**
 * One spoken sentence in, one structured action out.
 *
 * Nothing is executed here. The route returns what it understood and the client
 * shows it for confirmation before any existing mutation runs — dictation
 * mishears names and numbers routinely, and a voice command that acts on its
 * own turns a mishearing into a wrong customer in a chair or money recorded
 * that never moved.
 */
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!shop) return NextResponse.json({ error: "NO_SHOP" }, { status: 403 });

  const [chairs, services, live] = await Promise.all([
    supabase
      .from("chairs")
      .select("id, label, staff_name")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("services")
      .select("id, name, rate")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .order("created_at"),
    // Which chairs are occupied right now, so "খালি চেয়ারে বসাও" can resolve.
    supabase
      .from("serials")
      .select("chair_id")
      .eq("shop_id", shop.id)
      .eq("status", "IN_PROGRESS"),
  ]);

  if (!services.data?.length) {
    return NextResponse.json({ error: "NO_SERVICES" }, { status: 422 });
  }

  const busyChairs = new Set((live.data ?? []).map((r) => r.chair_id));

  let client;
  try {
    client = getAnthropicClient();
  } catch (err) {
    if (err instanceof Error && err.message === ANTHROPIC_KEY_MISSING) {
      return NextResponse.json({ error: ANTHROPIC_KEY_MISSING }, { status: 503 });
    }
    throw err;
  }

  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 8000,
    system: VOICE_INTENT_SYSTEM,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: `${voiceContextAsPrompt(
          (chairs.data ?? []).map((c) => ({
            id: c.id,
            name: c.staff_name || c.label,
            busy: busyChairs.has(c.id),
          })),
          services.data,
        )}

দোকানদার বলেছে: "${parsed.data.transcript}"`,
      },
    ],
    output_config: { format: zodOutputFormat(VoiceIntentSchema) },
  });

  if (!response.parsed_output) {
    return NextResponse.json({ error: "PARSE_FAILED" }, { status: 502 });
  }

  // Belt and braces on the ids. The prompt forbids inventing them, but this is
  // the boundary where a hallucinated id would become a failed insert with a
  // meaningless error — better to say "I didn't understand" than to try.
  const intent = response.parsed_output;
  const serviceIds = new Set(services.data.map((s) => s.id));
  const chairIds = new Set((chairs.data ?? []).map((c) => c.id));

  const badWalkIn =
    intent.intent === "add_walk_in" &&
    (!intent.walkIn ||
      intent.walkIn.serviceIds.length === 0 ||
      intent.walkIn.serviceIds.some((id) => !serviceIds.has(id)) ||
      (intent.walkIn.chairId !== null && !chairIds.has(intent.walkIn.chairId)));

  const badIncome =
    intent.intent === "add_manual_income" &&
    (!intent.manualIncome || !serviceIds.has(intent.manualIncome.serviceId));

  if (badWalkIn || badIncome) {
    return NextResponse.json({
      intent: {
        ...intent,
        intent: "unknown" as const,
        reason: "কোন সার্ভিস বা চেয়ার বোঝা যায়নি — সার্ভিসের নাম বলে আবার চেষ্টা করো।",
      },
    });
  }

  return NextResponse.json({ intent });
}
