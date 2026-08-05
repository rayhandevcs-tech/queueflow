"use client";

import { useState } from "react";
import { Armchair } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";
import { useProviderQueue } from "../hooks/use-provider-queue";
import { useSerialActions } from "../hooks/use-serial-actions";
import { providerQueueDict } from "../lib/i18n";
import { BoardHeader } from "./BoardHeader";
import { ChairColumn } from "./ChairColumn";
import { WalkInDialog } from "./WalkInDialog";

export function QueueBoard({
  shopId,
  breakSlot,
}: {
  shopId: string;
  breakSlot?: React.ReactNode;
}) {
  const { lanes, totals, rows, isPending, isError } = useProviderQueue(shopId);
  const actions = useSerialActions(shopId);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const t = useT(providerQueueDict);

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-live">{t("boardLoadFailed")}</p>;
  }

  return (
    <div className="space-y-4">
      <BoardHeader
        totals={totals}
        onWalkIn={() => setWalkInOpen(true)}
        breakSlot={breakSlot}
      />

      {lanes.length === 0 ? (
        <EmptyState
          icon={<Armchair className="h-6 w-6" />}
          title={t("noChairsTitle")}
          description={t("noChairsDesc")}
          action={
            <Link
              href="/chairs"
              className="text-sm font-semibold text-accent hover:underline"
            >
              {t("addChairCta")}
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-4 md:grid md:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
          {lanes.map((lane) => (
            <ChairColumn
              key={lane.chair.id}
              lane={lane}
              lanes={lanes}
              boardRows={rows}
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
