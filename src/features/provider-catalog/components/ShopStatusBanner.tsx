"use client";

import Link from "next/link";
import { Ban, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useMyShop } from "../hooks/use-my-shop";
import { providerCatalogDict } from "../lib/i18n";

/**
 * A shop that isn't ACTIVE is invisible in Explore, which from the owner's side
 * looks exactly like "the app is broken". This banner is the explanation, shown
 * on every provider screen until the status clears.
 */
export function ShopStatusBanner() {
  const { data: shop } = useMyShop();
  const t = useT(providerCatalogDict);

  // `?? "ACTIVE"` keeps a deploy that lands before the migration harmless:
  // no status column means no lifecycle yet, so nothing to warn about.
  if (!shop || (shop.status ?? "ACTIVE") === "ACTIVE") return null;

  const variant =
    shop.status === "PENDING"
      ? {
          icon: <Clock className="h-4.5 w-4.5" />,
          title: t("shopPendingTitle"),
          body: t("shopPendingBody"),
          className: "border-brass/40 bg-brass-soft/50 text-brass",
        }
      : shop.status === "SUSPENDED"
        ? {
            icon: <Ban className="h-4.5 w-4.5" />,
            title: t("shopSuspendedTitle"),
            body: t("shopSuspendedBody"),
            className: "border-live/30 bg-live-soft text-live",
          }
        : {
            icon: <XCircle className="h-4.5 w-4.5" />,
            title: t("shopRejectedTitle"),
            body: t("shopRejectedBody"),
            className: "border-live/30 bg-live-soft text-live",
          };

  return (
    <div className={cn("mb-4 flex items-start gap-2.5 rounded-2xl border p-3.5", variant.className)}>
      <span className="mt-0.5 shrink-0">{variant.icon}</span>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-bold">{variant.title}</p>
        <p className="text-xs text-ink/70">{variant.body}</p>
        {shop.status_reason && (
          <p className="rounded-lg bg-card/70 px-2.5 py-1.5 text-xs font-medium text-ink">
            {shop.status_reason}
          </p>
        )}
        {shop.status !== "PENDING" && (
          <Link href="/help" className="inline-block pt-0.5 text-xs font-semibold underline">
            {t("shopStatusContactSupport")}
          </Link>
        )}
      </div>
    </div>
  );
}
