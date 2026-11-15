export default function BoothLoading() {
  return (
    <div className="page-shell py-8 sm:py-12">
      <div className="h-6 w-28 animate-pulse rounded-full bg-blush" />
      <div className="mt-4 h-12 w-72 max-w-full animate-pulse rounded-2xl bg-blush/70" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="h-[560px] animate-pulse rounded-3xl border border-blush/60 bg-white/60" />
        <div className="h-[420px] animate-pulse rounded-3xl border border-blush/60 bg-white/60" />
      </div>
    </div>
  );
}
