"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, X } from "lucide-react";
import { parseServicesSnapshot, type Serial, type Shop } from "@/types";
import { Spinner } from "@/components/ui/Spinner";
import { formatBanglaDate, formatBanglaTime, formatMoney } from "@/lib/format-wait";

export function EReceiptSheet({
  serial,
  shop,
  onClose,
}: {
  serial: Serial;
  shop: Shop | undefined;
  onClose: () => void;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const services = parseServicesSnapshot(serial.services_snapshot);
  const code = serial.id.slice(0, 8).toUpperCase();
  const when = new Date(serial.completed_at ?? serial.created_at);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(serial.id, { width: 200, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [serial.id]);

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-card p-5">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-muted hover:bg-soft hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-center">
          <p className="font-display text-lg font-bold text-ink">{shop?.name ?? "দোকান"}</p>
          <p className="mt-0.5 text-xs text-muted">
            {formatBanglaDate(when)} · {formatBanglaTime(when)}
          </p>
        </div>

        <div className="my-4.5 grid place-items-center">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt={`রিসিট কোড ${code}`} className="h-40 w-40 rounded-xl border border-line" />
          ) : (
            <div className="grid h-40 w-40 place-items-center rounded-xl border border-line bg-soft">
              <Spinner className="h-5 w-5 text-muted" />
            </div>
          )}
          <p className="mt-2 font-number text-sm font-bold tracking-widest text-ink">{code}</p>
        </div>

        <div className="rounded-[14px] border border-line bg-soft p-3.5">
          <div className="flex flex-col gap-2">
            {services.map((s) => (
              <div key={s.service_id} className="flex items-center justify-between text-[13px] text-ink">
                <span>{s.name}</span>
                <span className="font-number">৳{formatMoney(s.rate)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5 text-sm font-bold text-ink">
            <span>মোট</span>
            <span className="font-number">৳{formatMoney(serial.total_amount)}</span>
          </div>
        </div>

        <a
          href={qrUrl ?? undefined}
          download={qrUrl ? `receipt-${code}.png` : undefined}
          aria-disabled={!qrUrl}
          className="mt-4.5 flex w-full items-center justify-center gap-2 rounded-[15px] bg-accent py-3.5 font-display text-[15px] font-bold text-accent-ink aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          ডাউনলোড
        </a>
      </div>
    </div>
  );
}
