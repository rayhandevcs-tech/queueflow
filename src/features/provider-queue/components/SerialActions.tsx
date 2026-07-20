"use client";

import { useState } from "react";
import { Check, Play, UserX } from "lucide-react";
import { UiDbError } from "@/lib/supabase/db-errors";
import { cn } from "@/lib/utils";
import type { Serial } from "@/types";
import type { useSerialActions } from "../hooks/use-serial-actions";
import { MoveSerialMenu } from "./MoveSerialMenu";
import type { Lane } from "../lib/lanes";

interface Props {
  serial: Serial;
  variant: "waiting" | "in-progress";
  canStart: boolean;
  lanes: Lane[];
  actions: ReturnType<typeof useSerialActions>;
}

export function SerialActions({
  serial,
  variant,
  canStart,
  lanes,
  actions,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  const surface = (err: unknown) => {
    if (err instanceof UiDbError && err.silent) return; // race → board already true
    setError(err instanceof Error ? err.message : "Something went wrong");
  };

  const run = (fn: () => void) => {
    setError(null);
    fn();
  };

  const btn =
    "min-h-9 flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-50";

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        {variant === "in-progress" ? (
          <>
            <button
              className={cn(btn, "bg-good text-accent-ink hover:brightness-110")}
              disabled={actions.complete.isPending}
              onClick={() =>
                run(() =>
                  actions.complete.mutate(serial.id, { onError: surface }),
                )
              }
            >
              <Check className="h-3.5 w-3.5" />
              Done
            </button>
            <button
              className={cn(btn, "max-w-24 bg-soft text-muted hover:bg-line")}
              disabled={actions.cancel.isPending}
              onClick={() =>
                run(() =>
                  actions.cancel.mutate(serial.id, { onError: surface }),
                )
              }
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {canStart && (
              <button
                className={cn(btn, "bg-accent text-accent-ink hover:brightness-110")}
                disabled={actions.start.isPending}
                onClick={() =>
                  run(() =>
                    actions.start.mutate(serial.id, { onError: surface }),
                  )
                }
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Start
              </button>
            )}
            <button
              className={cn(btn, "bg-brass-soft text-brass hover:brightness-105")}
              disabled={actions.noShow.isPending}
              onClick={() =>
                run(() =>
                  actions.noShow.mutate(serial.id, { onError: surface }),
                )
              }
            >
              <UserX className="h-3.5 w-3.5" />
              No-show
            </button>
            <MoveSerialMenu
              serial={serial}
              lanes={lanes}
              onMove={(targetChairId) =>
                run(() =>
                  actions.move.mutate(
                    { serialId: serial.id, targetChairId },
                    { onError: surface },
                  ),
                )
              }
              moving={actions.move.isPending}
            />
          </>
        )}
      </div>
      {error && <p className="text-xs text-live">{error}</p>}
    </div>
  );
}
