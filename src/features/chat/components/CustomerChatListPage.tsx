"use client";

import { useT } from "@/lib/i18n";
import { useMyChatThreads } from "../hooks/use-chat-threads";
import { ChatThreadList } from "./ChatThreadList";
import { chatDict } from "../lib/i18n";

export function CustomerChatListPage() {
  const { threads, isPending } = useMyChatThreads();
  const t = useT(chatDict);

  return (
    <ChatThreadList
      threads={threads}
      isPending={isPending}
      hrefFor={(shopId) => `/explore/${shopId}/chat`}
      title={t("chatTitle")}
    />
  );
}
