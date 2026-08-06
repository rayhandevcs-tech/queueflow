import type { Metadata } from "next";
import { DisplayBoardView } from "@/features/shop-display/components/DisplayBoardView";

export const metadata: Metadata = {
  title: "Live Queue",
  // A wall display has no business in anyone's search results.
  robots: { index: false, follow: false },
};

/**
 * The shop's own counter screen — deliberately outside every route group.
 *
 * No auth (nobody signs in on a display), no nav shell, no bottom bar: it
 * renders full-bleed on whatever old phone or tablet the shop props up. The
 * middleware leaves /display alone precisely because it isn't in any of the
 * role-gated prefix lists.
 */
export default async function ShopDisplayPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  return <DisplayBoardView shopId={shopId} />;
}
