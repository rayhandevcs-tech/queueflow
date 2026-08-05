"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";
import { useMyChatThreads } from "../hooks/use-chat-threads";
import { ChatThreadList } from "./ChatThreadList";
import { chatDict } from "../lib/i18n";

export function CustomerChatListPage({ activeKey }: { activeKey?: string }) {
  const { threads, isPending } = useMyChatThreads();
  const [myId, setMyId] = useState<string | null>(null);
  const t = useT(chatDict);

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));
  }, []);

  return (
    <ChatThreadList
      threads={threads}
      isPending={isPending}
      hrefFor={(shopId) => `/explore/${shopId}/chat`}
      title={t("chatTitle")}
      myId={myId}
      activeKey={activeKey}
    />
  );
}
