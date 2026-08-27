import { NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AI_MODEL, ANTHROPIC_KEY_MISSING, getAnthropicClient } from "@/lib/anthropic/client";
import { createServerSupabase } from "@/lib/supabase/server";
import { StyleAdviceSchema } from "@/features/customer-style/lib/advice-schema";
import { catalogueAsPrompt, STYLE_ADVISOR_SYSTEM } from "@/features/customer-style/lib/prompt";

/**
 * Compressed client-side to a few hundred KB before it gets here, so anything
 * near this ceiling is not a photo someone picked from their camera roll.
 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const BodySchema = z.object({
  /** Bare base64, no data: prefix — the client strips it. */
  image: z.string().min(100),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  kind: z.enum(["HAIR", "BEARD"]),
});

/**
 * Look at one face, recommend styles from the catalogue.
 *
 * The photo is held in memory for the length of this request and never written
 * anywhere — not to Storage, not to a table, not to a log. A face is biometric
 * data, and the safest place to keep it is nowhere: the customer sees the
 * advice, the shop sees the style they chose, and nobody has a folder of
 * customers' faces to lose.
 */
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  // base64 runs about 4 characters per 3 bytes.
  if ((parsed.data.image.length * 3) / 4 > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "IMAGE_TOO_LARGE" }, { status: 413 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Signed in only — this costs money per call, and an open endpoint that
  // spends money is an open endpoint someone will spend for us.
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { data: catalogue } = await supabase
    .from("hairstyles")
    .select("slug, kind, name_en, description_en, suits_notes_en")
    .eq("is_active", true)
    .eq("kind", parsed.data.kind)
    .order("sort_order");

  if (!catalogue?.length) {
    return NextResponse.json({ error: "NO_CATALOGUE" }, { status: 422 });
  }

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
    max_tokens: 16000,
    system: STYLE_ADVISOR_SYSTEM,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: parsed.data.mediaType,
              data: parsed.data.image,
            },
          },
          {
            type: "text",
            text: `${catalogueAsPrompt(catalogue)}

আমার মুখের সাথে কোন ${parsed.data.kind === "BEARD" ? "দাড়ির" : "চুলের"} স্টাইল মানাবে?`,
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(StyleAdviceSchema) },
  });

  // A safety decline arrives as a normal 200 — check before reading content.
  if (response.stop_reason === "refusal") {
    return NextResponse.json({ error: "REFUSED" }, { status: 422 });
  }

  if (!response.parsed_output) {
    return NextResponse.json({ error: "PARSE_FAILED" }, { status: 502 });
  }

  // Drop anything that isn't a real style. A hallucinated slug would render as
  // an empty card and, worse, as advice the shop cannot act on.
  const known = new Set(catalogue.map((c) => c.slug));
  const advice = {
    ...response.parsed_output,
    recommendations: response.parsed_output.recommendations.filter((r) => known.has(r.slug)),
    avoid:
      response.parsed_output.avoid && known.has(response.parsed_output.avoid.slug)
        ? response.parsed_output.avoid
        : null,
  };

  if (advice.recommendations.length === 0) {
    return NextResponse.json({ error: "NO_MATCH" }, { status: 422 });
  }

  return NextResponse.json({ advice });
}
