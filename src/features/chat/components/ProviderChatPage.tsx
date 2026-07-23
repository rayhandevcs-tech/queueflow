"use client";

import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { Spinner } from "@/components/ui/Spinner";
import { getCustomerDisplayName } from "../api/chat.api";
import { useMyShopId } from "../hooks/use-chat-shop";
import { ChatThreadView } from "./ChatThreadView";

export function ProviderChatPage({ customerId }: { customerId: string }) {
  const { data: shopId, isPending: shopPending } = useMyShopId();

  const nameQuery = useQuery({
    queryKey: keys.messages.customerName(shopId ?? "", customerId),
    queryFn: () => getCustomerDisplayName(shopId!, customerId),
    enabled: !!shopId,
  });

  if (shopPending || nameQuery.isPending) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (!shopId) {
    return <p className="p-6 text-sm text-ink">দোকান খুঁজে পাওয়া যায়নি।</p>;
  }

  const name = nameQuery.data || "কাস্টমার";

  return (
    <ChatThreadView
      shopId={shopId}
      customerId={customerId}
      backHref="/dashboard"
      otherPartyName={name}
      otherPartyInitial={name.trim().charAt(0).toUpperCase() || "?"}
    />
  );
}
