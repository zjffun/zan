/** A round initial on a color derived from the id: the same person always gets the same avatar. */
export function Avatar({ id, name, size = "md" }: { id: string; name: string; size?: "sm" | "md" | "lg" }) {
  let hash = 0;
  for (const char of id || name) hash = (hash * 31 + char.codePointAt(0)!) % 360;
  const dimension = size === "lg" ? "size-16 text-2xl" : size === "sm" ? "size-6 text-xs" : "size-8 text-sm";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white ${dimension}`}
      style={{ background: `hsl(${hash} 38% 46%)` }}
    >
      {Array.from(name.trim())[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
