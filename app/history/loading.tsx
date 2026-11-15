export default function HistoryLoading() {
  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="h-6 w-36 animate-pulse rounded-full bg-blush" />
      <div className="mt-4 h-12 w-72 max-w-full animate-pulse rounded-2xl bg-blush/70" />
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-52 animate-pulse rounded-3xl border border-blush/60 bg-white/60" />
        ))}
      </div>
    </div>
  );
}
