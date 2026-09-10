import { ShopDetailWithMembership } from "./_components/ShopDetailWithMembership";

export default async function ShopDetailPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  // Not ShopDetailView directly: the membership tab is composed in, because
  // features may not import each other.
  return <ShopDetailWithMembership shopId={shopId} />;
}
