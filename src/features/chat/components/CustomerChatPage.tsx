"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { Spinner } from "@/components/ui/Spinner";
import { useShopBasics } from "../hooks/use-chat-shop";
import { ChatThreadView } from "./ChatThreadView";

export function CustomerChatPage({ shopId }: { shopId: string }) {
  const [myId, setMyId] = useState<string | null>(null);
  const { data: shop, isPending } = useShopBasics(shopId);

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));
  }, []);

  if (isPending || !myId) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (!shop) {
    return <p className="p-6 text-sm text-ink">দোকান খুঁজে পাওয়া যায়নি।</p>;
  }

  return (
    <ChatThreadView
      shopId={shopId}
      customerId={myId}
      backHref={`/explore/${shopId}`}
      otherPartyName={shop.name}
      otherPartyInitial={shopInitial(shop.name)}
      otherPartyAvatarBg={shopAvatarColor(shop.id)}
    />
  );
}
