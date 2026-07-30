"use client";

import { useRouter } from "next/navigation";
import { Copy, MessageCircle, Navigation, Phone, Share2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { Shop } from "@/types";
import { useT } from "@/lib/i18n";
import { customerBookingDict } from "../lib/i18n";

interface Props {
  shop: Shop;
  hasHistory: boolean | undefined;
}

function ActionButton({
  icon,
  label,
  onClick,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const content = (
    <>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-soft text-ink">
        {icon}
      </span>
      <span className="text-[11px] font-medium text-muted">{label}</span>
    </>
  );
  const className = "flex flex-1 flex-col items-center gap-1";

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

export function ShopQuickActions({ shop, hasHistory }: Props) {
  const router = useRouter();
  const showToast = useToast();
  const t = useT(customerBookingDict);

  const hasCoords = shop.latitude != null && shop.longitude != null;

  const onShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: shop.name, url });
      } catch {
        // user cancelled the share sheet — no-op
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast(t("linkCopied"));
    } catch {
      showToast(t("linkCopyFailed"));
    }
  };

  return (
    <div className="mt-3.5 flex items-stretch rounded-2xl border border-line bg-card p-2.5">
      {shop.phone && (
        <ActionButton icon={<Phone className="h-4 w-4" />} label={t("call")} href={`tel:${shop.phone}`} />
      )}
      {hasHistory && (
        <ActionButton
          icon={<MessageCircle className="h-4 w-4" />}
          label={t("message")}
          onClick={() => router.push(`/explore/${shop.id}/chat`)}
        />
      )}
      {hasCoords && (
        <ActionButton
          icon={<Navigation className="h-4 w-4" />}
          label={t("direction")}
          href={`https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`}
        />
      )}
      <ActionButton
        icon={
          typeof navigator !== "undefined" && typeof navigator.share === "function" ? (
            <Share2 className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )
        }
        label={t("share")}
        onClick={() => void onShare()}
      />
    </div>
  );
}
