"use client";

import { useMutation } from "@tanstack/react-query";
import { sendBroadcast, type BroadcastTarget } from "../api/notifications.api";

export function useSendBroadcast(shopId: string | undefined) {
  return useMutation({
    mutationFn: (payload: { target: BroadcastTarget; title: string; body: string }) =>
      sendBroadcast({ shopId: shopId!, ...payload }),
  });
}
