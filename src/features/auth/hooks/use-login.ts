"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signIn, signInAdmin } from "../api/auth.api";

/**
 * Everything cached before a sign-in belongs to whoever was here before —
 * usually nobody. Dropping the cache is what makes the next screen ask the
 * database as the person who just signed in.
 *
 * The admin panel showed this most clearly. AdminShell calls
 * useIsPlatformAdmin() on every path under /admin, including /admin/login,
 * where the answer is necessarily "no" — and that "no" was cached with a
 * five-minute staleTime. Landing on /admin straight after a successful login
 * read it back and rendered "এই পাতা তোমার জন্য নয়" at a session that was
 * perfectly valid; a manual reload wiped the in-memory cache, which is why
 * refreshing "fixed" it.
 *
 * clear() rather than invalidate: an invalidated query still serves its stale
 * value while refetching, so the wrong screen would flash anyway. Cleared
 * queries start empty, so the shell shows its spinner until the real answer
 * arrives.
 */
function useSignIn<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.clear(),
  });
}

export function useLogin() {
  return useSignIn(signIn);
}

export function useAdminLogin() {
  return useSignIn(signInAdmin);
}
