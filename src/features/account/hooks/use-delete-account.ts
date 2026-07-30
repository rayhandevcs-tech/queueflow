"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { deleteMyAccount } from "../api/delete-account.api";

export function useDeleteMyAccount() {
  const router = useRouter();
  return useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: () => {
      router.replace("/login");
      router.refresh();
    },
  });
}
