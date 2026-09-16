import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * "No thanks."
 *
 * A separate tiny endpoint rather than a flag on the confirm route, because
 * the two must not share a code path. Confirming and declining are the two
 * outcomes it matters most to keep apart, and a single handler branching on a
 * boolean is one inverted condition away from booking something the customer
 * just refused.
 *
 * What this does: PROPOSED → CANCELLED, through `ai_action_cancel()`, which
 * matches on `auth.uid()` and refuses any other current status. What it cannot
 * do: touch `serials`. There is no import of `joinQueue` here and no Supabase
 * write outside that one RPC, so "cancel means no mutation" is a property of
 * the file rather than a promise about it.
 *
 * Cancelling something already confirmed or executed is refused by the
 * function, not silently accepted — a customer who declines after the booking
 * has gone through needs to cancel the SERIAL, on their own queue screen, and
 * telling them this worked would leave them expecting a shop not to expect
 * them.
 */
const BodySchema = z.object({ actionId: z.string().uuid() });

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { error } = await supabase.rpc("ai_action_cancel", {
    p_action_id: parsed.data.actionId,
  });

  if (error) {
    // `ai_action_not_cancellable` covers "not yours", "no such proposal" and
    // "already past PROPOSED" — one answer on purpose, since distinguishing
    // them would tell a caller whether somebody else's id was real.
    return NextResponse.json(
      { ok: false, code: "NOT_CANCELLABLE" },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
