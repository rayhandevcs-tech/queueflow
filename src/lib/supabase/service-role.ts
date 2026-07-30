import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Full-privilege client, bypasses RLS. Only ever import this from the
 * /api/push/send route handler — it must never reach client bundles.
 */
export function getServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
