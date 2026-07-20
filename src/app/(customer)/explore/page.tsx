import { ExploreView } from "@/features/customer-explore/components/ExploreView";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ExplorePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nearby Shops"
        description="Pick a shop that's open near you"
      />
      <ExploreView />
    </div>
  );
}
