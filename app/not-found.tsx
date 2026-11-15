import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-shell py-24 text-center">
      <p className="font-display text-7xl text-blush">404</p>
      <h1 className="mt-4 font-display text-4xl text-maroon">Halaman tidak ditemukan</h1>
      <p className="muted mx-auto mt-3 max-w-md">Mungkin tautannya sudah berubah atau halaman ini tidak pernah ada.</p>
      <div className="mt-7 flex justify-center gap-2">
        <Link href="/" className="btn btn-primary">
          Ke beranda
        </Link>
        <Link href="/gallery" className="btn btn-secondary">
          Lihat gallery
        </Link>
      </div>
    </div>
  );
}
