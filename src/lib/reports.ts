import { getBrowserClient } from "@/lib/supabase/client";
import type { ReportReason, ReportTargetType } from "@/types";

export const REPORT_REASONS: readonly ReportReason[] = [
  "SPAM",
  "ABUSE",
  "FAKE",
  "INAPPROPRIATE",
  "OTHER",
];

/**
 * File a report against a review / shop / message / user. The DB rejects a
 * second OPEN report from the same person about the same thing (partial unique
 * index), and blocked users can't report at all — both enforced in RLS, not
 * here, so the button can stay this simple.
 */
export async function createReport(input: {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  note?: string | null;
}): Promise<void> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not logged in");

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    note: input.note?.trim() || null,
  });
  if (error) throw error;
}

/** Postgres unique-violation for the "one open report per target" index. */
export function isDuplicateReport(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}
