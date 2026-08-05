"use client";

import { cn } from "@/lib/utils";

/**
 * Desktop (md:+): list pane and detail pane render side by side, list stays
 * visible while a thread is open. Mobile (<md): exactly one pane at a time,
 * driven purely by whether `detail` is present — reproduces the old
 * full-screen-per-route behavior with zero navigation change on mobile.
 * Both panes always mount (visibility is CSS-only) so the list's data/
 * realtime hooks never get torn down by a mobile route change.
 */
export function ChatSplitShell({
  list,
  detail,
  emptyDetail,
}: {
  list: React.ReactNode;
  detail: React.ReactNode | null;
  emptyDetail: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100dvh-5.5rem)] overflow-hidden rounded-2xl border border-line md:h-[calc(100dvh-2.5rem)]">
      <div
        className={cn(
          "h-full min-h-0 flex-col overflow-y-auto border-line p-3 md:flex md:w-[360px] md:shrink-0 md:border-r",
          detail ? "hidden" : "flex w-full",
        )}
      >
        {list}
      </div>
      <div
        className={cn(
          "h-full min-h-0 flex-1 flex-col overflow-hidden p-3",
          detail ? "flex w-full" : "hidden md:flex",
        )}
      >
        {detail ?? emptyDetail}
      </div>
    </div>
  );
}
