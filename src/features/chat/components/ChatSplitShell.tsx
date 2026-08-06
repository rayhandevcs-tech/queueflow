"use client";

import { cn } from "@/lib/utils";

/**
 * Desktop (md:+): list pane and detail pane render side by side, list stays
 * visible while a thread is open. Mobile (<md): exactly one pane at a time,
 * driven purely by whether `detail` is present — reproduces the old
 * full-screen-per-route behavior with zero navigation change on mobile.
 * Both panes always mount (visibility is CSS-only) so the list's data/
 * realtime hooks never get torn down by a mobile route change.
 *
 * Visually the two panes are separated by tone, not just a rule: the list sits
 * on the card surface and the thread on paper, so the split reads even where
 * the divider is behind a scrolled message.
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
    <div className="flex h-[calc(100dvh-5.5rem)] overflow-hidden rounded-3xl border border-line bg-card shadow-sm md:h-[calc(100dvh-2.5rem)]">
      <div
        className={cn(
          "h-full min-h-0 flex-col overflow-hidden border-line bg-card p-3 md:flex md:w-[360px] md:shrink-0 md:border-r lg:w-[380px]",
          detail ? "hidden" : "flex w-full",
        )}
      >
        {list}
      </div>
      <div
        className={cn(
          "h-full min-h-0 flex-1 flex-col overflow-hidden bg-paper",
          detail ? "flex w-full" : "hidden md:flex",
        )}
      >
        {detail ?? emptyDetail}
      </div>
    </div>
  );
}
