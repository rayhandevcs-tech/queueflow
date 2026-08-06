"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut } from "../api/auth.api";

/**
 * @param to where to land afterwards. The admin panel passes its own door:
 *   /login refuses admin accounts, so sending an admin there would leave them
 *   one wrong screen away from signing back in.
 */
export function useLogout(to: string = "/login") {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      // The signed-out user's serials, chats and profile are still sitting in
      // the cache. Without this they stay readable in the tab, and whoever
      // signs in next briefly sees them.
      queryClient.clear();
      router.replace(to);
      router.refresh();
    },
  });
}
