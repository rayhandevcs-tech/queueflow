"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import { RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n";
import { customerStyleDict } from "../lib/i18n";

interface Placement {
  /** Fractions of the photo's width/height, so it survives any container size. */
  x: number;
  y: number;
  scale: number;
}

/**
 * A rough visual, positioned by hand.
 *
 * There is no face detection here, and that is a deliberate choice rather than
 * a shortcut. Landmark detection in the browser means shipping a WASM model of
 * several megabytes to phones on slow connections, and the browser's own
 * FaceDetector API is Chrome-only and behind a flag — so it would fail for most
 * of the people this app is built for. Dragging the overlay into place takes a
 * couple of seconds, works on every device, and never misplaces the hair
 * because a face was turned slightly away.
 *
 * The result is honestly a sticker, not a photorealistic try-on. It answers
 * "roughly how would this shape look on me", which is the question worth
 * answering before a haircut.
 */
export function TryOnCanvas({
  photoUrl,
  overlayUrl,
  styleName,
}: {
  photoUrl: string;
  overlayUrl: string | null;
  styleName: string;
}) {
  const t = useT(customerStyleDict);
  const frameRef = useRef<HTMLDivElement>(null);

  // Opens roughly where hair sits on a centred portrait — near enough that most
  // people nudge it rather than hunt for it.
  const initial: Placement = { x: 0.5, y: 0.32, scale: 0.62 };
  const [placement, setPlacement] = useState<Placement>(initial);

  // Pointer id → last position, so two fingers can pinch and one can drag
  // without either path knowing about the other.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!overlayUrl) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!overlayUrl || !pointers.current.has(e.pointerId)) return;
    const frame = frameRef.current;
    if (!frame) return;

    const previous = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const box = frame.getBoundingClientRect();
    const points = [...pointers.current.values()];

    if (points.length >= 2) {
      const [a, b] = points;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (!pinchStart.current) {
        pinchStart.current = { distance, scale: placement.scale };
        return;
      }
      const ratio = distance / (pinchStart.current.distance || 1);
      setPlacement((p) => ({
        ...p,
        scale: Math.min(1.6, Math.max(0.2, pinchStart.current!.scale * ratio)),
      }));
      return;
    }

    pinchStart.current = null;
    const dx = (e.clientX - previous.x) / box.width;
    const dy = (e.clientY - previous.y) / box.height;
    setPlacement((p) => ({
      ...p,
      // Clamped a little outside the frame so the overlay can hang off an edge
      // without being lost entirely.
      x: Math.min(1.2, Math.max(-0.2, p.x + dx)),
      y: Math.min(1.2, Math.max(-0.2, p.y + dy)),
    }));
  };

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  };

  return (
    <div className="space-y-2.5">
      <div
        ref={frameRef}
        className="relative aspect-3/4 w-full touch-none overflow-hidden rounded-2xl bg-soft select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
      >
        {/* The customer's own photo, held only in this browser as an object URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL from the user's own file, not a remote asset */}
        <img src={photoUrl} alt="" className="h-full w-full object-cover" draggable={false} />

        {overlayUrl ? (
          <Image
            src={overlayUrl}
            alt={styleName}
            width={512}
            height={512}
            unoptimized
            draggable={false}
            className="pointer-events-none absolute origin-center"
            style={{
              left: `${placement.x * 100}%`,
              top: `${placement.y * 100}%`,
              width: `${placement.scale * 100}%`,
              height: "auto",
              transform: "translate(-50%, -50%)",
            }}
          />
        ) : (
          <p className="absolute inset-x-3 bottom-3 rounded-xl bg-ink/70 p-2.5 text-center text-[11px] text-paper">
            {t("tryOnNoOverlay")}
          </p>
        )}
      </div>

      {overlayUrl && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted">{t("tryOnHint")}</p>
          <button
            type="button"
            onClick={() => setPlacement(initial)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:text-ink"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t("resetCta")}
          </button>
        </div>
      )}
    </div>
  );
}
