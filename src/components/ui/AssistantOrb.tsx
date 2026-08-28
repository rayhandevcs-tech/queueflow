"use client";

import { cn } from "@/lib/utils";

/**
 * A living icon for the assistant.
 *
 * The whole effect is CSS on three overlapping shapes — no Lottie, no canvas,
 * no animation library. A chat bubble sits on every page of the app, so it has
 * to cost nothing: a JSON animation file would be more bytes than some of the
 * screens it floats over, on phones already on slow connections.
 *
 * Motion stops entirely under `prefers-reduced-motion`. A shape that pulses
 * forever in the corner of the screen is exactly the kind of thing that setting
 * exists for, and the icon still reads perfectly when still.
 */
export function AssistantOrb({
  size = 24,
  className,
  /** "idle" breathes slowly; "thinking" speeds up while an answer streams. */
  state = "idle",
}: {
  size?: number;
  className?: string;
  state?: "idle" | "thinking";
}) {
  const thinking = state === "thinking";

  return (
    <span
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Halo — the slow outward breath that makes the mark feel alive. */}
      <span
        className={cn(
          "absolute inset-0 rounded-full bg-current opacity-25 motion-safe:animate-ping",
          thinking ? "[animation-duration:1.1s]" : "[animation-duration:3s]",
        )}
      />

      {/* Core — a four-point sparkle. Drawn rather than imported so its arms
          can scale independently of the halo. */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={cn(
          "relative motion-safe:animate-pulse",
          thinking ? "[animation-duration:0.9s]" : "[animation-duration:2.4s]",
        )}
        style={{ width: size, height: size }}
      >
        <path
          d="M12 2.5c.35 3.9 2.1 5.65 6 6-3.9.35-5.65 2.1-6 6-.35-3.9-2.1-5.65-6-6 3.9-.35 5.65-2.1 6-6Z"
          fill="currentColor"
        />
        {/* A second, smaller spark, offset — one star reads as a static icon,
            two at different rhythms read as something in motion. */}
        <path
          d="M18.5 14.5c.17 1.9 1.02 2.75 2.9 2.92-1.88.17-2.73 1.02-2.9 2.9-.17-1.88-1.02-2.73-2.9-2.9 1.88-.17 2.73-1.02 2.9-2.92Z"
          fill="currentColor"
          className={cn(
            "origin-center opacity-70 motion-safe:animate-pulse",
            thinking ? "[animation-duration:1.4s]" : "[animation-duration:3.6s]",
          )}
          style={{ animationDelay: "0.4s" }}
        />
      </svg>
    </span>
  );
}
