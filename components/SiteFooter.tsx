import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-blush/60 bg-white/50">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="max-w-sm">
          <p className="font-display text-2xl text-maroon">SnapBooth</p>
          <p className="mt-2 text-sm leading-relaxed text-plum/70">
            Photo booth online untuk mengabadikan momen kecil yang terasa besar. Ambil foto, pilih frame,
            unduh, dan simpan kenangannya.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-plum/70">
          <Link href="/booth" className="hover:text-maroon">
            Photo Booth
          </Link>
          <Link href="/gallery" className="hover:text-maroon">
            Gallery
          </Link>
          <Link href="/history" className="hover:text-maroon">
            Riwayat Unduhan
          </Link>
          <Link href="/login" className="hover:text-maroon">
            Masuk
          </Link>
        </div>
      </div>
      <div className="border-t border-blush/40 px-4 py-4 text-center text-xs text-plum/50">
        © {new Date().getFullYear()} SnapBooth. Dibuat dengan warna pink, putih, dan maroon.
      </div>
    </footer>
  );
}
