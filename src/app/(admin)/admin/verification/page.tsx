import { RecentShopsView } from "@/features/admin/components/RecentShopsView";

/**
 * Kept at /admin/verification so existing links and bookmarks still land
 * somewhere useful — the screen behind it is now the new-shop watchlist, since
 * shops go live on registration and nothing waits for approval.
 */
export default function AdminVerificationPage() {
  return <RecentShopsView />;
}
