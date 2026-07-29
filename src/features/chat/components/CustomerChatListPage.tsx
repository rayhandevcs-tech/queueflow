"use client";

import { useMyChatThreads } from "../hooks/use-chat-threads";
import { ChatThreadList } from "./ChatThreadList";

export function CustomerChatListPage() {
  const { threads, isPending } = useMyChatThreads();

  return (
    <ChatThreadList
      threads={threads}
      isPending={isPending}
      hrefFor={(shopId) => `/explore/${shopId}/chat`}
      title="চ্যাট"
    />
  );
}
