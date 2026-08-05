import { CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaymentMethodValue } from "@/config/constants";

/**
 * No official logo assets in this project — a colored badge with the
 * brand's own color + a short wordmark reads as "the real thing" at a
 * glance without shipping trademarked SVGs.
 */
const BRAND: Record<PaymentMethodValue, { bg: string; label: string }> = {
  cash: { bg: "var(--color-good)", label: "৳" },
  bkash: { bg: "#E2136E", label: "bK" },
  nagad: { bg: "#EC1D25", label: "নগ" },
  rocket: { bg: "#8C3494", label: "R" },
  card: { bg: "#64748B", label: "" },
};

export function PaymentMethodIcon({
  method,
  size = 44,
  className,
}: {
  method: PaymentMethodValue;
  size?: number;
  className?: string;
}) {
  const b = BRAND[method];
  return (
    <div
      className={cn("grid shrink-0 place-items-center rounded-[14px] font-display font-bold text-white", className)}
      style={{ width: size, height: size, background: b.bg, fontSize: size * 0.36 }}
    >
      {method === "card" ? <CreditCard style={{ width: size * 0.5, height: size * 0.5 }} /> : b.label}
    </div>
  );
}
