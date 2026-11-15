import type { Metadata } from "next";
import Link from "next/link";
import { db, type RowDataPacket } from "@/lib/db";
import { mapStrip } from "@/lib/mappers";
import { formatShortDate } from "@/lib/format";
import { like } from "@/lib/api";
import type { PhotoStrip } from "@/lib/types";
import { CameraIcon, DownloadIcon, GridIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/States";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Jelajahi photo strip publik yang dibuat di SnapBooth.",
};

const PAGE_SIZE = 9;

async function getGallery(page: number, search: string) {
  const where: string[] = ["ps.is_public = 1"];
  const values: unknown[] = [];
  if (search) {
    where.push("(ps.caption LIKE ? OR u.name LIKE ? OR s.session_code LIKE ?)");
    const term = like(search);
    values.push(term, term, term);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const [[countRow]] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM photo_strips ps
     JOIN photo_sessions s ON s.id = ps.session_id
     LEFT JOIN users u ON u.id = s.user_id ${whereSql}`,
    values,
  );
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ps.*, s.session_code, u.name AS user_name, f.name AS frame_name, fl.name AS filter_name
     FROM photo_strips ps
     JOIN photo_sessions s ON s.id = ps.session_id
     LEFT JOIN users u ON u.id = s.user_id
     LEFT JOIN frames f ON f.id = ps.frame_id
     LEFT JOIN filters fl ON fl.id = ps.filter_id
     ${whereSql}
     ORDER BY ps.created_at DESC, ps.id DESC LIMIT ? OFFSET ?`,
    [...values, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );
  return { strips: rows.map(mapStrip), total: Number(countRow.total) };
}

function pageHref(page: number, search: string) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/gallery?${query}` : "/gallery";
}

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const requestedPage = Number(params.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const search = (params.search ?? "").trim().slice(0, 120);

  let strips: PhotoStrip[] = [];
  let total = 0;
  let errorMessage: string | null = null;
  try {
    const result = await getGallery(page, search);
    strips = result.strips;
    total = result.total;
  } catch {
    errorMessage = "Gallery tidak dapat dimuat saat ini. Coba muat ulang halaman.";
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="badge bg-blush/60 text-maroon">
            <GridIcon className="mr-1.5 h-3.5 w-3.5" />
            Gallery publik
          </span>
          <h1 className="mt-4 text-4xl tracking-tight text-maroon sm:text-5xl">Momen dari SnapBooth.</h1>
          <p className="muted mt-3 max-w-xl">
            Photo strip yang dibagikan publik. Temukan inspirasi pose, frame, dan filter untuk sesimu.
          </p>
        </div>
        <Link href="/booth" className="btn btn-primary shrink-0">
          <CameraIcon className="h-4 w-4" />
          Buat photo strip
        </Link>
      </div>

      <form action="/gallery" method="get" className="mt-8 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="search" className="sr-only">
          Cari photo strip
        </label>
        <input
          id="search"
          name="search"
          defaultValue={search}
          className="input sm:max-w-md"
          placeholder="Cari caption atau nama pembuat…"
        />
        <button type="submit" className="btn btn-secondary">
          Cari
        </button>
        {search ? (
          <Link href="/gallery" className="btn btn-ghost">
            Reset
          </Link>
        ) : null}
      </form>

      {errorMessage ? (
        <div role="alert" className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 px-6 py-10 text-center text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : strips.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<GridIcon className="h-6 w-6" />}
            title={search ? "Tidak ada hasil" : "Gallery masih kosong"}
            description={
              search
                ? `Tidak ada photo strip publik yang cocok dengan “${search}”. Coba kata kunci lain.`
                : "Jadilah yang pertama membagikan photo strip ke gallery publik SnapBooth."
            }
            action={{ href: "/booth", label: "Ambil foto sekarang" }}
          />
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {strips.map((strip) => (
              <article key={strip.id} className="card group overflow-hidden">
                <div className="relative flex h-[420px] items-center justify-center bg-gradient-to-br from-blush/40 via-white to-[#ffe9f1] p-4">
                  <img
                    src={strip.imageUrl}
                    alt={strip.caption ? `Photo strip: ${strip.caption}` : "Photo strip SnapBooth"}
                    className="max-h-full w-auto rounded-xl object-contain shadow-[0_25px_55px_-35px_rgba(90,31,49,0.55)] transition duration-300 group-hover:scale-[1.02]"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-maroon backdrop-blur">
                    {strip.frameName ?? "SnapBooth"}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-xl text-maroon">
                        {strip.caption || "Untitled moment"}
                      </h2>
                      <p className="mt-1 text-xs text-plum/55">
                        {strip.userName ?? "Tamu SnapBooth"} · {formatShortDate(strip.createdAt)}
                      </p>
                    </div>
                    <a
                      href={`/api/photo-strips/${strip.id}/download`}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blush/50 text-maroon transition hover:bg-maroon hover:text-white"
                      aria-label={`Unduh photo strip ${strip.caption ?? strip.id}`}
                    >
                      <DownloadIcon className="h-4 w-4" />
                    </a>
                  </div>
                  <p className="mt-3 text-xs text-plum/45">Filter: {strip.filterName ?? "Original"}</p>
                </div>
              </article>
            ))}
          </div>

          <nav className="mt-10 flex flex-col items-center justify-between gap-3 text-sm text-plum/70 sm:flex-row" aria-label="Navigasi halaman gallery">
            <p>
              Halaman {page} dari {totalPages} · {total} photo strip
            </p>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link href={pageHref(page - 1, search)} className="btn btn-secondary px-4 py-2">
                  Sebelumnya
                </Link>
              ) : (
                <span className="btn btn-secondary pointer-events-none px-4 py-2 opacity-40">Sebelumnya</span>
              )}
              {page < totalPages ? (
                <Link href={pageHref(page + 1, search)} className="btn btn-secondary px-4 py-2">
                  Berikutnya
                </Link>
              ) : (
                <span className="btn btn-secondary pointer-events-none px-4 py-2 opacity-40">Berikutnya</span>
              )}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
