import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AI_MODEL, ANTHROPIC_KEY_MISSING, getAnthropicClient } from "@/lib/anthropic/client";
import { gatherShopBrief, NO_SHOP } from "@/features/provider-ai/api/gather-brief";
import { briefAsPrompt, SHOP_ANALYST_SYSTEM } from "@/features/provider-ai/lib/prompt";
import { InsightsSchema } from "@/features/provider-ai/lib/insights-schema";

export async function POST() {
  let brief;
  try {
    brief = await gatherShopBrief();
  } catch (err) {
    if (err instanceof Error && err.message === NO_SHOP) {
      return NextResponse.json({ error: NO_SHOP }, { status: 403 });
    }
    throw err;
  }

  // Nothing to analyse and no reason to spend a model call saying so.
  if (brief.months.length === 0) {
    return NextResponse.json({ error: "NO_DATA" }, { status: 422 });
  }

  try {
    const client = getAnthropicClient();

    const response = await client.messages.parse({
      model: AI_MODEL,
      max_tokens: 16000,
      system: SHOP_ANALYST_SYSTEM,
      thinking: { type: "adaptive" },
      messages: [
        {
          role: "user",
          content: `${briefAsPrompt(brief)}

এই দোকানের হিসাব দেখে বলো — কী ভালো চলছে, কোথায় টাকা বা কাস্টমার হারাচ্ছে, আর এই সপ্তাহে কী করা উচিত।`,
        },
      ],
      output_config: { format: zodOutputFormat(InsightsSchema) },
    });

    if (!response.parsed_output) {
      return NextResponse.json({ error: "PARSE_FAILED" }, { status: 502 });
    }

    return NextResponse.json({
      insights: response.parsed_output,
      generatedAt: brief.generatedAt,
    });
  } catch (err) {
    if (err instanceof Error && err.message === ANTHROPIC_KEY_MISSING) {
      return NextResponse.json({ error: ANTHROPIC_KEY_MISSING }, { status: 503 });
    }
    throw err;
  }
}
