import { CustomerChatPage } from "@/features/chat/components/CustomerChatPage";

export default async function ShopChatPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  return <CustomerChatPage shopId={shopId} />;
}
