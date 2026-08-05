import { ChatSplitShell } from "@/features/chat/components/ChatSplitShell";
import { CustomerChatListPage } from "@/features/chat/components/CustomerChatListPage";
import { EmptyDetailPlaceholder } from "@/features/chat/components/EmptyDetailPlaceholder";

export default function ChatsPage() {
  return (
    <ChatSplitShell
      list={<CustomerChatListPage />}
      detail={null}
      emptyDetail={<EmptyDetailPlaceholder />}
    />
  );
}
