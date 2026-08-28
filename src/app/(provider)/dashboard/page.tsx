import Link from "next/link";
import { Settings } from "lucide-react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query/query-client";
import { createServerSupabase } from "@/lib/supabase/server";
import { keys } from "@/lib/query/keys";
import { ACTIVE_STATUSES } from "@/config/constants";
import { QueueBoard } from "@/features/provider-queue/components/QueueBoard";
import { ShopBreakControl } from "@/features/provider-catalog/components/ShopBreakControl";
import { VoiceCommandButton } from "@/features/provider-voice/components/VoiceCommandButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { translate } from "@/lib/i18n";
import { providerCatalogDict } from "@/features/provider-catalog/lib/i18n";

export default async function DashboardPage() {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select("*")
    .eq("owner_id", user?.id ?? "")
    .maybeSingle();

  if (!shop) {
    return (
      <EmptyState
        icon={<Settings className="h-6 w-6" />}
        title={translate(providerCatalogDict, "noShopTitle")}
        action={
          <Link href="/settings" className="text-sm font-semibold text-accent hover:underline">
            {translate(providerCatalogDict, "goToSettings")}
          </Link>
        }
      />
    );
  }

  const queryClient = getQueryClient();

  await Promise.all([
    // 1) Active serials — the board itself
    queryClient.prefetchQuery({
      queryKey: keys.serials.byShop(shop.id),
      queryFn: async () => {
        const { data, error } = await supabase
          .from("serials")
          .select("*")
          .eq("shop_id", shop.id)
          .in("status", [...ACTIVE_STATUSES])
          .order("chair_id")
          .order("position");
        if (error) throw error;
        return data;
      },
    }),

    // 2) Chairs — lane definitions
    queryClient.prefetchQuery({
      queryKey: keys.chairs.byShop(shop.id),
      queryFn: async () => {
        const { data, error } = await supabase
          .from("chairs")
          .select("*")
          .eq("shop_id", shop.id)
          .order("sort_order");
        if (error) throw error;
        return data;
      },
    }),

    // 3) Active services — WalkInDialog's picker (spec-required prefetch)
    queryClient.prefetchQuery({
      queryKey: keys.services.byShop(shop.id),
      queryFn: async () => {
        const { data, error } = await supabase
          .from("services")
          .select("*")
          .eq("shop_id", shop.id)
          .eq("is_active", true)
          .order("created_at");
        if (error) throw error;
        return data;
      },
    }),

    // 4) Shop row — BoardHeader's is_open pill (bonus, already in cache anyway)
    queryClient.prefetchQuery({
      queryKey: keys.shops.detail(shop.id),
      queryFn: async () => shop,
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* The break control lives in provider-catalog and the board in
          provider-queue; features can't import each other, so the page is
          where the two are composed. */}
      <QueueBoard
        shopId={shop.id}
        breakSlot={<ShopBreakControl shop={shop} />}
        voiceSlot={<VoiceCommandButton shopId={shop.id} />}
      />
    </HydrationBoundary>
  );
}