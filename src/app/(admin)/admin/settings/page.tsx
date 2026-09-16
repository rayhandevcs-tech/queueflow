import { PageHeader } from "@/components/ui/PageHeader";
import { PlatformLoyaltyCard } from "@/features/admin/components/PlatformLoyaltyCard";
import { adminDict } from "@/features/admin/lib/i18n";
import { translate } from "@/lib/i18n/translate";

/**
 * Platform-wide defaults. One card today; the roadmap's admin backlog has
 * feature flags and maintenance mode queued behind it, which is why this is a
 * page rather than a field bolted onto an existing screen.
 */
export default function AdminSettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title={translate(adminDict, "settingsTitle", "bn")}
        description={translate(adminDict, "settingsSubtitle", "bn")}
      />
      <PlatformLoyaltyCard />
    </div>
  );
}
