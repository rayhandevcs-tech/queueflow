import { ProviderChatPage } from "@/features/chat/components/ProviderChatPage";

export default async function ShopOwnerChatPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  return <ProviderChatPage customerId={customerId} />;
}
