import Link from "next/link";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  icon = "✦",
}: {
  title: string;
  description: string;
  action?: { href: string; label: string };
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-pink/70 bg-white/70 px-6 py-14 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-blush/60 text-2xl text-maroon" aria-hidden="true">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-2xl text-maroon">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-plum/70">{description}</p>
      {action ? (
        <Link href={action.href} className="btn btn-primary mt-6">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function LoadingState({ label = "Memuat data…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-3xl border border-blush bg-white/70 px-6 py-16 text-sm text-plum/70">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-pink border-t-maroon" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50/70 px-6 py-10 text-center">
      <p className="font-semibold text-rose-900">Terjadi kesalahan</p>
      <p className="mt-2 text-sm text-rose-800/80">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn btn-secondary mt-5">
          Coba lagi
        </button>
      ) : null}
    </div>
  );
}
