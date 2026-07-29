import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export function AvatarChip({
  label,
  avatarUrl,
  size = 44,
  className,
}: {
  label?: string | null;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = label?.trim()?.charAt(0)?.toUpperCase();

  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-soft font-display font-bold text-accent",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={label ?? ""} className="h-full w-full object-cover" />
      ) : (
        initial || <UserRound style={{ width: size * 0.45, height: size * 0.45 }} />
      )}
    </div>
  );
}
