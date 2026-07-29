"use client";

import { useMyShopId } from "../hooks/use-chat-shop";
import { useShopChatThreads } from "../hooks/use-chat-threads";
import { ChatThreadList } from "./ChatThreadList";

export function ProviderChatListPage() {
  const { data: shopId } = useMyShopId();
  const { threads, isPending } = useShopChatThreads(shopId ?? undefined);

  return (
    <ChatThreadList
      threads={threads}
      isPending={isPending}
      hrefFor={(customerId) => `/chat/${customerId}`}
      title="চ্যাট"
    />
  );
}
