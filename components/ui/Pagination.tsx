"use client";

import { cn } from "@/lib/format";

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-3 text-sm text-plum/70 sm:flex-row sm:items-center sm:justify-between">
      <p>
        Halaman <span className="font-semibold text-maroon">{page}</span> dari{" "}
        <span className="font-semibold text-maroon">{Math.max(1, totalPages)}</span> · {total} data
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className={cn("btn btn-secondary px-4 py-2", page <= 1 && "cursor-not-allowed opacity-40")}
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
        >
          Sebelumnya
        </button>
        <button
          type="button"
          className={cn(
            "btn btn-secondary px-4 py-2",
            page >= totalPages && "cursor-not-allowed opacity-40",
          )}
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
        >
          Berikutnya
        </button>
      </div>
    </div>
  );
}
