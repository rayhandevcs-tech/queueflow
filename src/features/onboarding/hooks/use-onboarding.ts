"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { completeOnboarding, skipOnboarding } from "../api/onboarding.api";

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeOnboarding,
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.profile.mine(), profile);
    },
  });
}

export function useSkipOnboarding() {
  return useMutation({ mutationFn: skipOnboarding });
}
