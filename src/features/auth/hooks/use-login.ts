"use client";

import { useMutation } from "@tanstack/react-query";
import { signIn } from "../api/auth.api";

export function useLogin() {
  return useMutation({ mutationFn: signIn });
}
