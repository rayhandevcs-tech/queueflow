"use client";

import { useParams } from "next/navigation";
import { ChatSplitShell } from "@/features/chat/components/ChatSplitShell";
import { EmptyDetailPlaceholder } from "@/features/chat/components/EmptyDetailPlaceholder";
import { ProviderChatListPage } from "@/features/chat/components/ProviderChatListPage";

export default function ProviderChatLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ customerId?: string }>();

  return (
    <ChatSplitShell
      list={<ProviderChatListPage activeKey={params.customerId} />}
      detail={params.customerId ? children : null}
      emptyDetail={<EmptyDetailPlaceholder />}
    />
  );
}
