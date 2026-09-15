import { ShopDetailWithExtras } from "./_components/ShopDetailWithExtras";

export default async function ShopDetailPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  // Not ShopDetailView directly: the membership and referral tabs are
  // composed in here, because features may not import each other.
  return <ShopDetailWithExtras shopId={shopId} />;
}
