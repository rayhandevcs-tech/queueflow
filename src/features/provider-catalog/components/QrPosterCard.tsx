"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Monitor, QrCode } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { site } from "@/config/site";
import { translate, useT } from "@/lib/i18n";
import type { Shop } from "@/types";
import { providerCatalogDict } from "../lib/i18n";

// A4 at 150 dpi — big enough to print sharply, small enough that the canvas
// stays instant on the mid-range Android this will actually run on.
const W = 1240;
const H = 1754;
const QR = 620;

function shopUrl(shopId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : site.url;
  return `${origin}/explore/${shopId}`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws the printable poster: headline, QR, shop name, and the URL as a fallback. */
async function buildPoster(shopName: string, url: string, qrDataUrl: string): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return qrDataUrl;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Accent band behind the headline so a photocopy still reads as branded.
  ctx.fillStyle = "#db4a4a";
  ctx.fillRect(0, 0, W, 330);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 76px sans-serif";
  const headline = wrap(ctx, translate(providerCatalogDict, "posterHeadline"), W - 140);
  let y = 330 / 2 - (headline.length - 1) * 46 + 26;
  for (const line of headline) {
    ctx.fillText(line, W / 2, y);
    y += 92;
  }

  y = 330 + 90;
  ctx.fillStyle = "#1b1812";
  ctx.font = "bold 62px sans-serif";
  for (const line of wrap(ctx, shopName, W - 160)) {
    ctx.fillText(line, W / 2, y);
    y += 76;
  }

  y += 40;
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = qrDataUrl;
  });
  ctx.drawImage(img, (W - QR) / 2, y, QR, QR);
  y += QR + 90;

  ctx.fillStyle = "#1b1812";
  ctx.font = "bold 52px sans-serif";
  for (const line of wrap(ctx, translate(providerCatalogDict, "posterSubline"), W - 160)) {
    ctx.fillText(line, W / 2, y);
    y += 66;
  }

  // Printed URL: not everyone's camera reads QR codes, and the poster should
  // still work for them.
  y += 30;
  ctx.fillStyle = "#6b6355";
  ctx.font = "36px sans-serif";
  ctx.fillText(url.replace(/^https?:\/\//, ""), W / 2, y);

  return canvas.toDataURL("image/png");
}

/**
 * A printable poster for the counter, and the link for the wall display.
 *
 * Both exist for the same reason: the customers a shop already has are the
 * cheapest ones to bring online, and they're standing right there.
 */
export function QrPosterCard({ shop }: { shop: Shop }) {
  const t = useT(providerCatalogDict);
  const showToast = useToast();
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const url = shopUrl(shop.id);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: QR, margin: 1 })
      .then((qr) => buildPoster(shop.name, url, qr))
      .then((poster) => {
        if (!cancelled) setPosterUrl(poster);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [shop.id, shop.name, url]);

  const displayUrl =
    typeof window !== "undefined" ? `${window.location.origin}/display/${shop.id}` : "";

  const copyDisplayLink = async () => {
    try {
      await navigator.clipboard.writeText(displayUrl);
      showToast(t("displayLinkCopied"));
    } catch {
      showToast(t("displayLinkCopyFailed"));
    }
  };

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <QrCode className="h-4 w-4" />
          {t("posterCardTitle")}
        </h2>
        <p className="mt-0.5 text-xs text-muted">{t("posterCardHint")}</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="mx-auto w-40 shrink-0 overflow-hidden rounded-xl border border-line bg-soft sm:mx-0">
          {posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={posterUrl} alt="" className="block w-full" />
          ) : (
            <div className="grid aspect-[1240/1754] place-items-center">
              {failed ? (
                <span className="px-2 text-center text-[11px] text-muted">
                  {t("posterFailed")}
                </span>
              ) : (
                <Spinner className="h-5 w-5 text-muted" />
              )}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3">
          <a
            href={posterUrl ?? undefined}
            download={`${shop.name}-poster.png`}
            className={posterUrl ? undefined : "pointer-events-none opacity-50"}
          >
            <Button variant="outline" className="w-full" disabled={!posterUrl}>
              <Download className="h-4 w-4" />
              {t("posterDownloadCta")}
            </Button>
          </a>

          <div className="rounded-xl bg-soft p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <Monitor className="h-3.5 w-3.5" />
              {t("displayCardTitle")}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted">{t("displayCardHint")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <a
                href={`/display/${shop.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-accent hover:underline"
              >
                {t("displayOpenCta")}
              </a>
              <button
                type="button"
                onClick={copyDisplayLink}
                className="text-xs font-semibold text-muted hover:text-ink"
              >
                {t("displayCopyCta")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
