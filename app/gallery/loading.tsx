export default function GalleryLoading() {
  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="h-6 w-36 animate-pulse rounded-full bg-blush" />
      <div className="mt-4 h-12 w-80 max-w-full animate-pulse rounded-2xl bg-blush/70" />
      <div className="mt-8 h-12 w-full max-w-md animate-pulse rounded-2xl bg-blush/50" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-[520px] animate-pulse rounded-3xl border border-blush/60 bg-white/60" />
        ))}
      </div>
    </div>
  );
}
