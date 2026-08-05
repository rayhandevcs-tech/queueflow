import { ShopDetailView } from "@/features/admin/components/ShopDetailView";

export default async function AdminShopDetailPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  return <ShopDetailView shopId={shopId} />;
}
