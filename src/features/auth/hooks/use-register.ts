"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signUp } from "../api/auth.api";

/**
 * With email confirmation switched off, signUp comes back with a session
 * already active — the person is signed in the moment they register. So the
 * cache has to be dropped here for the same reason it is on login: everything
 * in it was fetched as nobody, and the next screen must ask the database as
 * the account that now exists.
 */
export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signUp,
    onSuccess: () => queryClient.clear(),
  });
}
