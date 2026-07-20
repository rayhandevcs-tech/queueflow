import { ShopDetailView } from "@/features/customer-booking/components/ShopDetailView";

export default async function ShopDetailPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  return <ShopDetailView shopId={shopId} />;
}
