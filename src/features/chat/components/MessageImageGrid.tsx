export function MessageImageGrid({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={urls[0]} alt="" className="mb-1.5 max-h-64 w-full rounded-xl object-cover" />
    );
  }

  const visible = urls.slice(0, 4);
  const overflow = urls.length - 4;

  return (
    <div className="mb-1.5 grid grid-cols-2 gap-1">
      {visible.map((url, i) => (
        <div key={url} className="relative aspect-square overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-full w-full object-cover" />
          {i === 3 && overflow > 0 && (
            <div className="absolute inset-0 grid place-items-center bg-black/50 text-sm font-semibold text-white">
              +{overflow}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
