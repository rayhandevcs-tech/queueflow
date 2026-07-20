"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { signOut } from "../api/auth.api";

export function useLogout() {
  const router = useRouter();
  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      router.replace("/login");
      router.refresh();
    },
  });
}
