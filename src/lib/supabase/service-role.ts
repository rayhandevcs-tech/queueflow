import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/** Thrown when the deployment has no service-role key configured. */
export const SERVICE_ROLE_MISSING = "SERVICE_ROLE_MISSING";

/**
 * Full-privilege client, bypasses RLS. Server-only — it must never reach
 * client bundles.
 *
 * The key is checked rather than asserted with `!`. Without the check a
 * deployment that simply forgot SUPABASE_SERVICE_ROLE_KEY fails deep inside
 * supabase-js with "supabaseKey is required", surfacing to the panel as a bare
 * 500 — which is indistinguishable from a permissions problem and sends you
 * looking in the wrong place. Callers catch SERVICE_ROLE_MISSING and say so.
 */
export function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error(SERVICE_ROLE_MISSING);

  return createClient<Database>(url, key, { auth: { persistSession: false } });
}
