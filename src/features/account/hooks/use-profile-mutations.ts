"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { updateMyAvatar, updateMyProfile } from "../api/profile.api";

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.profile.mine(), profile);
    },
  });
}

export function useUpdateMyAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMyAvatar,
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.profile.mine(), profile);
    },
  });
}
