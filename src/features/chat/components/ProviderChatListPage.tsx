"use client";

import { useT } from "@/lib/i18n";
import { useMyShopId } from "../hooks/use-chat-shop";
import { useShopChatThreads } from "../hooks/use-chat-threads";
import { ChatThreadList } from "./ChatThreadList";
import { chatDict } from "../lib/i18n";

export function ProviderChatListPage() {
  const { data: shopId } = useMyShopId();
  const { threads, isPending } = useShopChatThreads(shopId ?? undefined);
  const t = useT(chatDict);

  return (
    <ChatThreadList
      threads={threads}
      isPending={isPending}
      hrefFor={(customerId) => `/chat/${customerId}`}
      title={t("chatTitle")}
    />
  );
}
