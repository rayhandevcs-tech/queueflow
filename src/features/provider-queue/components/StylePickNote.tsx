"use client";

import { createContext, useContext } from "react";
import { Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import type { QueueStylePick } from "../api/queue.api";

/**
 * The board's style picks, shared by context rather than threaded as a prop.
 *
 * Both the waiting row and the now-serving card need this, and both sit three
 * components below the board. Passing a map down through QueueBoard →
 * ChairColumn → each card would grow three prop lists for a lookup that is
 * read-only and incidental to what those components are actually about.
 */
const StylePicksContext = createContext<Map<string, QueueStylePick>>(new Map());

export const StylePicksProvider = StylePicksContext.Provider;

/**
 * What the customer asked for, if they said.
 *
 * Renders nothing when they didn't — most bookings will have no pick, and an
 * empty "no style chosen" row on every card would be noise on the one screen
 * that has to stay scannable while someone is waiting in the chair.
 */
export function StylePickNote({
  serialId,
  tone = "light",
}: {
  serialId: string;
  /** "onAccent" for the red now-serving card, where muted text disappears. */
  tone?: "light" | "onAccent";
}) {
  const picks = useContext(StylePicksContext);
  const { language } = useLanguage();
  const pick = picks.get(serialId);

  if (!pick) return null;

  const name = language === "bn" ? pick.nameBn : pick.nameEn;
  const onAccent = tone === "onAccent";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-1.5",
        onAccent ? "bg-accent-ink/15" : "bg-soft",
      )}
    >
      {pick.referenceImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pick.referenceImageUrl}
          alt=""
          className="h-7 w-7 shrink-0 rounded-md object-cover"
        />
      ) : (
        <span
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-md",
            onAccent ? "bg-accent-ink/20 text-accent-ink" : "bg-card text-muted",
          )}
        >
          <Scissors className="h-3.5 w-3.5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[11px] font-bold",
            onAccent ? "text-accent-ink" : "text-ink",
          )}
        >
          {name}
        </span>
        {pick.note && (
          <span
            className={cn(
              "block truncate text-[10px]",
              onAccent ? "text-accent-ink/70" : "text-muted",
            )}
          >
            {pick.note}
          </span>
        )}
      </span>
    </div>
  );
}
