"use client";

import { useState } from "react";
import { Armchair } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useProviderQueue } from "../hooks/use-provider-queue";
import { useSerialActions } from "../hooks/use-serial-actions";
import { BoardHeader } from "./BoardHeader";
import { ChairColumn } from "./ChairColumn";
import { WalkInDialog } from "./WalkInDialog";

export function QueueBoard({ shopId }: { shopId: string }) {
  const { lanes, totals, isPending, isError } = useProviderQueue(shopId);
  const actions = useSerialActions(shopId);
  const [walkInOpen, setWalkInOpen] = useState(false);

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-live">
        Couldn&apos;t load the board — please refresh.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <BoardHeader
        shopId={shopId}
        totals={totals}
        onWalkIn={() => setWalkInOpen(true)}
      />

      {lanes.length === 0 ? (
        <EmptyState
          icon={<Armchair className="h-6 w-6" />}
          title="No chairs yet"
          description="Add a chair to start building your live queue."
          action={
            <Link
              href="/chairs"
              className="text-sm font-semibold text-accent hover:underline"
            >
              Add a chair →
            </Link>
          }
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {lanes.map((lane) => (
            <ChairColumn
              key={lane.chair.id}
              lane={lane}
              lanes={lanes}
              actions={actions}
            />
          ))}
        </div>
      )}

      {walkInOpen && (
        <WalkInDialog
          shopId={shopId}
          lanes={lanes}
          actions={actions}
          onClose={() => setWalkInOpen(false)}
        />
      )}
    </div>
  );
}
