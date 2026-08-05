import { ChatSplitShell } from "@/features/chat/components/ChatSplitShell";
import { CustomerChatListPage } from "@/features/chat/components/CustomerChatListPage";
import { CustomerChatPage } from "@/features/chat/components/CustomerChatPage";
import { EmptyDetailPlaceholder } from "@/features/chat/components/EmptyDetailPlaceholder";

export default async function ShopChatPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  return (
    <ChatSplitShell
      list={<CustomerChatListPage activeKey={shopId} />}
      detail={<CustomerChatPage shopId={shopId} />}
      emptyDetail={<EmptyDetailPlaceholder />}
    />
  );
}
