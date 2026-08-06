"use client";

import { useMutation } from "@tanstack/react-query";
import { signIn, signInAdmin } from "../api/auth.api";

export function useLogin() {
  return useMutation({ mutationFn: signIn });
}

export function useAdminLogin() {
  return useMutation({ mutationFn: signInAdmin });
}
