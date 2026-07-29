export function ProfileHeaderCard({
  name,
  subtitle,
  avatarUrl,
  right,
}: {
  name: string;
  subtitle: string;
  avatarUrl?: string | null;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.75 rounded-[22px] bg-accent p-5 text-accent-ink">
      <div className="grid h-15 w-15 shrink-0 place-items-center overflow-hidden rounded-[18px] bg-white font-display text-2xl font-extrabold text-accent">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          name.trim().charAt(0).toUpperCase() || "?"
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg font-bold">{name || "—"}</p>
        <p className="truncate text-xs text-accent-ink/60">{subtitle || "—"}</p>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
