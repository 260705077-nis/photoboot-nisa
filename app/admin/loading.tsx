export default function AdminLoading() {
  return (
    <div>
      <div className="h-8 w-56 animate-pulse rounded-xl bg-blush/70" />
      <div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded-full bg-blush/40" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-3xl border border-blush/60 bg-white/60" />
        ))}
      </div>
    </div>
  );
}
