"use client";

import { useMyActiveSerial } from "@/features/customer-booking/hooks/use-my-serial";
import { StyleStudioView } from "@/features/customer-style/components/StyleStudioView";

export default function StylePage() {
  // Optional by design: browsing works without a booking, and only the
  // "tell the shop" step needs a serial to attach itself to.
  const { data: serial } = useMyActiveSerial();

  return <StyleStudioView serialId={serial?.id} />;
}
