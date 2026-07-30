"use client";

import { useState } from "react";
import { LiveTrackingView } from "@/features/customer-booking/components/LiveTrackingView";
import { TabBar } from "@/components/ui/TabBar";
import { Spinner } from "@/components/ui/Spinner";
import { useProfileHistory } from "@/features/customer-profile/hooks/use-profile-history";
import { CompletedBookingsList } from "@/features/customer-profile/components/CompletedBookingsList";
import { CancelledBookingsList } from "@/features/customer-profile/components/CancelledBookingsList";
import { customerProfileDict } from "@/features/customer-profile/lib/i18n";
import { useT } from "@/lib/i18n";

export default function MySerialPage() {
  const [tab, setTab] = useState("ongoing");
  const { history, shopsById, ratingsBySerial, isPending } = useProfileHistory();
  const t = useT(customerProfileDict);

  const TABS = [
    { id: "ongoing", label: t("ongoingTab") },
    { id: "completed", label: t("completedTab") },
    { id: "cancelled", label: t("cancelledTab") },
  ];

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-3.5 font-display text-xl font-bold text-ink">{t("myBookingsTitle")}</h1>
      <TabBar tabs={TABS} active={tab} onChange={setTab} className="mb-4" />

      {tab === "ongoing" && <LiveTrackingView />}

      {tab === "completed" &&
        (isPending ? (
          <div className="grid min-h-[40vh] place-items-center">
            <Spinner className="h-6 w-6 text-muted" />
          </div>
        ) : (
          <CompletedBookingsList
            bookings={history.filter((s) => s.status === "DONE")}
            shopsById={shopsById}
            ratingsBySerial={ratingsBySerial}
          />
        ))}

      {tab === "cancelled" &&
        (isPending ? (
          <div className="grid min-h-[40vh] place-items-center">
            <Spinner className="h-6 w-6 text-muted" />
          </div>
        ) : (
          <CancelledBookingsList
            bookings={history.filter((s) => s.status === "CANCELLED" || s.status === "NO_SHOW")}
            shopsById={shopsById}
          />
        ))}
    </div>
  );
}
