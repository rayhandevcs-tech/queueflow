"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, X } from "lucide-react";
import { parseServicesSnapshot, type Serial, type Shop } from "@/types";
import { Spinner } from "@/components/ui/Spinner";
import { formatBanglaDate, formatBanglaTime, formatMoney } from "@/lib/format-wait";
import { translate, useT } from "@/lib/i18n";
import { customerProfileDict } from "../lib/i18n";

const WIDTH = 420;
const PADDING = 28;
const QR_SIZE = 180;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Draws the full receipt (shop/date/QR/itemized services/total) onto a canvas so the download includes billing details, not just the QR image. */
async function buildReceiptImage(params: {
  shopName: string;
  when: Date;
  code: string;
  qrDataUrl: string;
  services: { service_id: string; name: string; rate: number }[];
  total: number;
}): Promise<string> {
  const { shopName, when, code, qrDataUrl, services, total } = params;
  const rowHeight = 32;
  const height =
    PADDING + 30 + 20 + QR_SIZE + 30 + 20 + services.length * rowHeight + 50 + PADDING;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return qrDataUrl;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, height);

  let y = PADDING;
  ctx.fillStyle = "#1b1812";
  ctx.textAlign = "center";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(shopName, WIDTH / 2, y + 20);
  y += 30;

  ctx.fillStyle = "#8a8478";
  ctx.font = "13px sans-serif";
  ctx.fillText(`${formatBanglaDate(when)} · ${formatBanglaTime(when)}`, WIDTH / 2, y + 12);
  y += 32;

  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, (WIDTH - QR_SIZE) / 2, y, QR_SIZE, QR_SIZE);
  y += QR_SIZE + 22;

  ctx.fillStyle = "#1b1812";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(code, WIDTH / 2, y);
  y += 24;

  ctx.strokeStyle = "#e5e1d8";
  ctx.beginPath();
  ctx.moveTo(PADDING, y);
  ctx.lineTo(WIDTH - PADDING, y);
  ctx.stroke();
  y += 26;

  ctx.textAlign = "left";
  ctx.font = "14px sans-serif";
  for (const s of services) {
    ctx.fillStyle = "#1b1812";
    ctx.fillText(s.name, PADDING, y);
    ctx.textAlign = "right";
    ctx.fillText(`৳${formatMoney(s.rate)}`, WIDTH - PADDING, y);
    ctx.textAlign = "left";
    y += rowHeight;
  }

  ctx.strokeStyle = "#e5e1d8";
  ctx.beginPath();
  ctx.moveTo(PADDING, y - 6);
  ctx.lineTo(WIDTH - PADDING, y - 6);
  ctx.stroke();
  y += 22;

  ctx.font = "bold 16px sans-serif";
  ctx.fillText(translate(customerProfileDict, "totalLabel"), PADDING, y);
  ctx.textAlign = "right";
  ctx.fillText(`৳${formatMoney(total)}`, WIDTH - PADDING, y);

  return canvas.toDataURL("image/png");
}

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
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const services = parseServicesSnapshot(serial.services_snapshot);
  const code = serial.id.slice(0, 8).toUpperCase();
  const when = new Date(serial.completed_at ?? serial.created_at);
  const t = useT(customerProfileDict);

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

  useEffect(() => {
    if (!qrUrl) return;
    let cancelled = false;
    buildReceiptImage({
      shopName: shop?.name ?? translate(customerProfileDict, "shopFallback"),
      when,
      code,
      qrDataUrl: qrUrl,
      services,
      total: serial.total_amount,
    })
      .then((url) => {
        if (!cancelled) setReceiptUrl(url);
      })
      .catch(() => {
        if (!cancelled) setReceiptUrl(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrUrl]);

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
          <p className="font-display text-lg font-bold text-ink">{shop?.name ?? t("shopFallback")}</p>
          <p className="mt-0.5 text-xs text-muted">
            {formatBanglaDate(when)} · {formatBanglaTime(when)}
          </p>
        </div>

        <div className="my-4.5 grid place-items-center">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt={t("receiptCodeAlt", code)} className="h-40 w-40 rounded-xl border border-line" />
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
            <span>{t("totalLabel")}</span>
            <span className="font-number">৳{formatMoney(serial.total_amount)}</span>
          </div>
        </div>

        <a
          href={receiptUrl ?? undefined}
          download={receiptUrl ? `receipt-${code}.png` : undefined}
          aria-disabled={!receiptUrl}
          className="mt-4.5 flex w-full items-center justify-center gap-2 rounded-[14px] bg-accent py-3.5 font-display text-[15px] font-bold text-accent-ink aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {t("download")}
        </a>
      </div>
    </div>
  );
}
