import { CircleCheck } from "lucide-react";

export function EmptyLane() {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-line py-6 text-center text-xs text-muted">
      <CircleCheck className="h-4 w-4" />
      This chair is free
    </div>
  );
}
