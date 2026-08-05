"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";
import { useMyShopId } from "../hooks/use-chat-shop";
import { useShopChatThreads } from "../hooks/use-chat-threads";
import { ChatThreadList } from "./ChatThreadList";
import { chatDict } from "../lib/i18n";

export function ProviderChatListPage({ activeKey }: { activeKey?: string }) {
  const { data: shopId } = useMyShopId();
  const { threads, isPending } = useShopChatThreads(shopId ?? undefined);
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
      hrefFor={(customerId) => `/chat/${customerId}`}
      title={t("chatTitle")}
      myId={myId}
      activeKey={activeKey}
    />
  );
}
