"use client";

import { useMutation } from "@tanstack/react-query";
import { requestPasswordReset } from "../api/auth.api";

export function useForgotPassword() {
  return useMutation({ mutationFn: requestPasswordReset });
}
