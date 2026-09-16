"use client";

import { useState } from "react";
import { LiveTrackingView } from "@/features/customer-booking/components/LiveTrackingView";
import { MyAppointmentsList } from "@/features/customer-booking/components/MyAppointmentsList";
import { TabBar } from "@/components/ui/TabBar";
import { Spinner } from "@/components/ui/Spinner";
import { usePreferredExperience } from "@/features/account/hooks/use-preferred-experience";
import { useProfileHistory } from "@/features/customer-profile/hooks/use-profile-history";
import { CompletedBookingsList } from "@/features/customer-profile/components/CompletedBookingsList";
import { CancelledBookingsList } from "@/features/customer-profile/components/CancelledBookingsList";
import { customerProfileDict } from "@/features/customer-profile/lib/i18n";
import { useT } from "@/lib/i18n";

/**
 * The customer's bookings — one page for both engines, since Sprint 5.
 *
 * Sprint 11 changed the ORDER of the two ongoing blocks and nothing else. A
 * parlour-minded customer opens this looking for the appointment they booked
 * last week, so appointments come first; a salon-minded one is checking how
 * far the queue has moved, so the live tracker does. Both blocks are always
 * rendered and each renders nothing when it has nothing, which is why this can
 * be a reordering rather than a branch — a parlour customer who once joined a
 * salon queue still sees it, just below.
 *
 * That is the whole shape of the preference: what you meet first, never what
 * exists.
 */
export default function MySerialPage() {
  const [tab, setTab] = useState("ongoing");
  const { history, shopsById, ratingsBySerial, isPending } = useProfileHistory();
  const { model } = usePreferredExperience();
  const t = useT(customerProfileDict);

  const TABS = [
    { id: "ongoing", label: t("ongoingTab") },
    { id: "completed", label: t("completedTab") },
    { id: "cancelled", label: t("cancelledTab") },
  ];

  const appointmentsFirst = model === "APPOINTMENT";

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-3.5 font-display text-xl font-bold text-ink">{t("myBookingsTitle")}</h1>
      <TabBar tabs={TABS} active={tab} onChange={setTab} className="mb-4" />

      {/* Each block renders nothing when empty, so a salon customer's page is
          unchanged and a parlour customer's simply leads with the diary. */}
      {tab === "ongoing" &&
        (appointmentsFirst ? (
          <>
            <MyAppointmentsList />
            <LiveTrackingView />
          </>
        ) : (
          <>
            <LiveTrackingView />
            <MyAppointmentsList />
          </>
        ))}

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
