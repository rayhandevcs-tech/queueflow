"use client";

import { useMutation } from "@tanstack/react-query";
import { signUp } from "../api/auth.api";

export function useRegister() {
  return useMutation({ mutationFn: signUp });
}
