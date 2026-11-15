"use client";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-12 text-center">
      <h2 className="font-display text-3xl text-rose-900">Dashboard gagal dimuat</h2>
      <p className="mt-3 text-sm text-rose-800">Terjadi kesalahan saat mengambil data dari server.</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-6">
        Coba lagi
      </button>
    </div>
  );
}
