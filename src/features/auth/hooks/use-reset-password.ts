"use client";

import { useMutation } from "@tanstack/react-query";
import { updatePassword } from "../api/auth.api";

export function useResetPassword() {
  return useMutation({ mutationFn: updatePassword });
}
