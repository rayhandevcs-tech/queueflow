/**
 * Services have no icon field in the DB — this is a deterministic,
 * name-based guess (not stored/fabricated data) so cards get a Palaa-style
 * emoji tile without a schema change.
 */
export function serviceEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("শেভ") || n.includes("shave")) return "🪒";
  if (n.includes("দাড়ি") || n.includes("beard")) return "🧔";
  if (n.includes("ফেসিয়াল") || n.includes("facial")) return "✨";
  if (n.includes("ওয়াশ") || n.includes("wash")) return "💧";
  if (n.includes("কালার") || n.includes("color") || n.includes("colour")) return "🎨";
  if (n.includes("ম্যাসাজ") || n.includes("massage")) return "💆";
  if (n.includes("নখ") || n.includes("nail") || n.includes("মেনিকিউর")) return "💅";
  if (n.includes("চুল") || n.includes("hair") || n.includes("কাট") || n.includes("cut")) return "✂️";
  return "💈";
}
