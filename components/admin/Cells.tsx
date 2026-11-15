export function Thumb({ src, contain = false }: { src: unknown; contain?: boolean }) {
  if (!src) return <span className="text-xs text-plum/30">—</span>;
  return (
    <img
      src={String(src)}
      alt=""
      className={`h-14 w-11 rounded-lg border border-blush/60 bg-blush/20 ${contain ? "object-contain" : "object-cover"}`}
    />
  );
}

export function StatusBadge({ value, labels }: { value: boolean; labels: [string, string] }) {
  return (
    <span className={`badge ${value ? "bg-emerald-50 text-emerald-700" : "bg-blush/50 text-plum/60"}`}>
      {value ? labels[0] : labels[1]}
    </span>
  );
}
