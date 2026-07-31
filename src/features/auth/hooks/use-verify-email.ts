"use client";

import { useMutation } from "@tanstack/react-query";
import { verifyEmailCode, resendVerificationCode } from "../api/auth.api";

export function useVerifyEmail() {
  return useMutation({ mutationFn: verifyEmailCode });
}

export function useResendCode() {
  return useMutation({ mutationFn: resendVerificationCode });
}
