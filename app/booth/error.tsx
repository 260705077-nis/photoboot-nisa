"use client";

import Link from "next/link";

export default function BoothError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="page-shell py-20 text-center">
      <h1 className="font-display text-3xl text-maroon">Photo Booth gagal dimuat</h1>
      <p className="muted mx-auto mt-3 max-w-md">Coba muat ulang halaman atau kembali ke beranda.</p>
      <div className="mt-6 flex justify-center gap-2">
        <button type="button" onClick={reset} className="btn btn-primary">
          Coba lagi
        </button>
        <Link href="/" className="btn btn-secondary">
          Beranda
        </Link>
      </div>
    </div>
  );
}
