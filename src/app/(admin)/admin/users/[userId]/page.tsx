import { UserDetailView } from "@/features/admin/components/UserDetailView";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <UserDetailView userId={userId} />;
}
