import { getBrowserClient } from "@/lib/supabase/client";

/**
 * Routed through /api/account/delete rather than calling the RPC directly:
 * removing the auth.users row is the only thing that frees the email address
 * for a future signup, and that goes through Supabase's Admin API, which needs
 * the service-role key. See the route.
 */
export async function deleteMyAccount(): Promise<void> {
  const response = await fetch("/api/account/delete", { method: "POST" });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "অ্যাকাউন্ট মোছা যায়নি");
  }

  // The session's user no longer exists; clear it locally so the app doesn't
  // keep refreshing a token that can never be renewed.
  await getBrowserClient().auth.signOut();
}
