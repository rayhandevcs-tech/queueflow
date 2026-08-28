import { NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AI_MODEL, ANTHROPIC_KEY_MISSING, getAnthropicClient } from "@/lib/anthropic/client";
import { createServerSupabase } from "@/lib/supabase/server";
import { ShopSetupSchema } from "@/features/provider-setup/lib/setup-schema";
import { boundingBox, computeBenchmarks } from "@/features/provider-setup/lib/benchmarks";
import {
  benchmarksAsPrompt,
  SHOP_SETUP_SYSTEM,
} from "@/features/provider-setup/lib/prompt";

const MAX_PHOTOS = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Wide enough to find neighbours in a Dhaka neighbourhood, not a whole city. */
const RADIUS_KM = 5;

const BodySchema = z.object({
  photos: z
    .array(
      z.object({
        data: z.string().min(100),
        mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      }),
    )
    .min(1)
    .max(MAX_PHOTOS),
});

/**
 * Turn a few photos into a draft shop profile, priced against real neighbours.
 *
 * The photos are read and discarded — they are not stored. The pricing is the
 * part that matters and the part nobody else can copy: it comes from what
 * shops of the same kind within a few kilometres are actually charging today,
 * out of our own tables.
 */
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const tooBig = parsed.data.photos.some(
    (p) => (p.data.length * 3) / 4 > MAX_IMAGE_BYTES,
  );
  if (tooBig) {
    return NextResponse.json({ error: "IMAGE_TOO_LARGE" }, { status: 413 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, business_type, latitude, longitude")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!shop) return NextResponse.json({ error: "NO_SHOP" }, { status: 403 });

  // Neighbours of the same kind. Without a location we simply have no
  // benchmarks — the prompt is told to say so rather than invent numbers, so
  // this degrades to "still useful" instead of "confidently wrong".
  let benchmarks: ReturnType<typeof computeBenchmarks> = [];

  if (shop.latitude !== null && shop.longitude !== null) {
    const box = boundingBox(shop.latitude, shop.longitude, RADIUS_KM);

    const { data: nearby } = await supabase
      .from("shops")
      .select("id")
      .eq("business_type", shop.business_type)
      .eq("status", "ACTIVE")
      .neq("id", shop.id)
      .gte("latitude", box.minLat)
      .lte("latitude", box.maxLat)
      .gte("longitude", box.minLon)
      .lte("longitude", box.maxLon);

    const ids = (nearby ?? []).map((s) => s.id);
    if (ids.length > 0) {
      const { data: services } = await supabase
        .from("services")
        .select("shop_id, name, rate, default_duration_min")
        .in("shop_id", ids)
        .eq("is_active", true);

      benchmarks = computeBenchmarks(services ?? []);
    }
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
    system: SHOP_SETUP_SYSTEM,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: [
          ...parsed.data.photos.map(
            (p) =>
              ({
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: p.mediaType,
                  data: p.data,
                },
              }),
          ),
          {
            type: "text",
            text: `${benchmarksAsPrompt(benchmarks)}

দোকানের নাম: ${shop.name}
ধরন: ${shop.business_type}

এই ছবিগুলো দেখে দোকানের একটা পরিচিতি লেখো আর সার্ভিসের তালিকা বানাও।`,
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(ShopSetupSchema) },
  });

  if (response.stop_reason === "refusal") {
    return NextResponse.json({ error: "REFUSED" }, { status: 422 });
  }
  if (!response.parsed_output) {
    return NextResponse.json({ error: "PARSE_FAILED" }, { status: 502 });
  }

  return NextResponse.json({
    draft: response.parsed_output,
    benchmarkCount: benchmarks.length,
  });
}
