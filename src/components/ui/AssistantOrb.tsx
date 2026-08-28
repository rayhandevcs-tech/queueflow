"use client";

import { cn } from "@/lib/utils";

/**
 * The assistant's face: a little robot that blinks, nods and waves an antenna.
 *
 * All of it is CSS keyframes on SVG parts — no Lottie, no canvas, no animation
 * library. This icon sits on every page of the app, so it has to cost nothing:
 * an animation file would be more bytes than some of the screens it floats
 * over, on phones already on slow connections.
 *
 * The movement is built from three separate rhythms rather than one loop,
 * because a single repeating motion reads as a spinner. The head bobs slowly,
 * the antenna light pulses at its own pace, and the eyes blink on a long cycle
 * with a double-blink in the middle — the irregularity is what makes it look
 * alive rather than mechanical.
 *
 * Everything stops under `prefers-reduced-motion` (Tailwind's `motion-safe:`),
 * and the robot still reads perfectly still. A face that moves forever in the
 * corner of the screen is exactly what that setting exists for.
 */
export function AssistantOrb({
  size = 24,
  className,
  /** "thinking" speeds the bob and keeps the eyes open while an answer streams. */
  state = "idle",
}: {
  size?: number;
  className?: string;
  state?: "idle" | "thinking";
}) {
  const thinking = state === "thinking";

  return (
    <span
      className={cn("relative inline-block", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <style>{ORB_KEYFRAMES}</style>

      <svg viewBox="0 0 32 32" fill="none" style={{ width: size, height: size }}>
        {/* Whole robot bobs; the antenna and eyes then move on top of that. */}
        <g
          className="motion-safe:[animation:ss-orb-bob_var(--bob)_ease-in-out_infinite]"
          style={{ ["--bob" as string]: thinking ? "1.1s" : "2.8s", transformOrigin: "16px 26px" }}
        >
          {/* Antenna stalk, then its light. */}
          <path
            d="M16 7.5V4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.9"
          />
          <circle
            cx="16"
            cy="3"
            r="2.2"
            fill="currentColor"
            className="motion-safe:[animation:ss-orb-blip_var(--blip)_ease-in-out_infinite]"
            style={{ ["--blip" as string]: thinking ? "0.7s" : "2s" }}
          />

          {/* Head. rx is generous so it reads as friendly at 17px, where a
              boxy robot turns into an indistinct square. */}
          <rect x="4.5" y="8" width="23" height="17" rx="7" fill="currentColor" />

          {/* Ears. */}
          <rect x="1.6" y="13.5" width="2.6" height="6" rx="1.3" fill="currentColor" opacity="0.75" />
          <rect x="27.8" y="13.5" width="2.6" height="6" rx="1.3" fill="currentColor" opacity="0.75" />

          {/* Eyes, knocked out of the head so they take the button's colour
              rather than needing one of their own. scaleY is what blinks;
              transform-box keeps the origin on the eye, not the whole svg. */}
          <g
            className={cn(
              !thinking &&
                "motion-safe:[animation:ss-orb-blink_5.5s_ease-in-out_infinite]",
            )}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <circle cx="11.6" cy="16.5" r="2.5" className="fill-[var(--color-accent)]" />
            <circle cx="20.4" cy="16.5" r="2.5" className="fill-[var(--color-accent)]" />
          </g>

          {/* Mouth — a short bar that widens a touch on the bob, which reads as
              a small smile rather than a fixed line. */}
          <rect
            x="13"
            y="21"
            width="6"
            height="1.6"
            rx="0.8"
            className="fill-[var(--color-accent)] opacity-60 motion-safe:[animation:ss-orb-mouth_var(--bob)_ease-in-out_infinite]"
            style={{ ["--bob" as string]: thinking ? "1.1s" : "2.8s", transformBox: "fill-box", transformOrigin: "center" }}
          />
        </g>
      </svg>
    </span>
  );
}

/**
 * Inlined rather than added to globals.css: the animation belongs to this
 * component and nothing else uses it, so keeping it here means deleting the
 * file deletes the keyframes too. Identical `<style>` content is deduplicated
 * by the browser, so repeating the widget costs nothing.
 */
const ORB_KEYFRAMES = `
@keyframes ss-orb-bob {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  30%      { transform: translateY(-1.1px) rotate(-2.5deg); }
  70%      { transform: translateY(0.5px) rotate(2deg); }
}
@keyframes ss-orb-blip {
  0%, 100% { opacity: 1; r: 2.2; }
  50%      { opacity: 0.45; r: 1.7; }
}
@keyframes ss-orb-blink {
  0%, 88%, 100% { transform: scaleY(1); }
  90%           { transform: scaleY(0.1); }
  92%           { transform: scaleY(1); }
  94%           { transform: scaleY(0.1); }
  96%           { transform: scaleY(1); }
}
@keyframes ss-orb-mouth {
  0%, 100% { transform: scaleX(1); }
  40%      { transform: scaleX(1.35); }
}
`;
