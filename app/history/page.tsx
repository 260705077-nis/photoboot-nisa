import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db, type RowDataPacket } from "@/lib/db";
import { mapDownload } from "@/lib/mappers";
import { formatDate } from "@/lib/format";
import type { Download } from "@/lib/types";
import { CameraIcon, DownloadIcon, HeartIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/States";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Riwayat Unduhan",
  description: "Photo strip yang pernah kamu unduh dari SnapBooth.",
};

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/history");

  let downloads: Download[] = [];
  let errorMessage: string | null = null;
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT d.*, ps.image_url, ps.caption, u.name AS user_name
       FROM downloads d
       JOIN photo_strips ps ON ps.id = d.photo_strip_id
       LEFT JOIN users u ON u.id = d.user_id
       WHERE d.user_id = ?
       ORDER BY d.created_at DESC, d.id DESC LIMIT 100`,
      [user.id],
    );
    downloads = rows.map(mapDownload);
  } catch {
    errorMessage = "Riwayat unduhan tidak dapat dimuat saat ini.";
  }

  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="badge bg-blush/60 text-maroon">
            <HeartIcon className="mr-1.5 h-3.5 w-3.5" />
            Koleksi pribadi
          </span>
          <h1 className="mt-4 text-4xl tracking-tight text-maroon sm:text-5xl">Riwayat unduhan.</h1>
          <p className="muted mt-3 max-w-xl">
            Halo {user.name.split(" ")[0]}, ini photo strip yang pernah kamu unduh. Klik unduh untuk menyimpannya lagi.
          </p>
        </div>
        <Link href="/booth" className="btn btn-primary shrink-0">
          <CameraIcon className="h-4 w-4" />
          Sesi foto baru
        </Link>
      </div>

      {errorMessage ? (
        <div role="alert" className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 px-6 py-10 text-center text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : downloads.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<DownloadIcon className="h-6 w-6" />}
            title="Belum ada unduhan"
            description="Photo strip yang kamu unduh akan muncul di sini. Mulai sesi pertamamu sekarang."
            action={{ href: "/booth", label: "Mulai Photo Booth" }}
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {downloads.map((download) => (
            <article key={download.id} className="card flex gap-4 p-3 sm:gap-5 sm:p-4">
              <div className="h-40 w-28 shrink-0 overflow-hidden rounded-2xl bg-blush/30 sm:h-44 sm:w-32">
                {download.imageUrl ? (
                  <img
                    src={download.imageUrl}
                    alt={download.caption ?? "Photo strip"}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <p className="line-clamp-2 font-display text-xl leading-tight text-maroon">
                  {download.caption || "Untitled moment"}
                </p>
                <p className="mt-2 text-xs text-plum/50">Diunduh {formatDate(download.createdAt)}</p>
                <p className="mt-1 text-xs text-plum/40">ID photo strip #{download.photoStripId}</p>
                <a
                  href={`/api/photo-strips/${download.photoStripId}/download`}
                  className="btn btn-secondary mt-4 self-start px-4 py-2"
                >
                  <DownloadIcon className="h-4 w-4" />
                  Unduh lagi
                </a>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-10 rounded-3xl border border-blush/60 bg-white/55 p-5 text-sm leading-relaxed text-plum/60">
        Riwayat menampilkan maksimal 100 unduhan terakhir. Data unduhan tamu tidak terhubung ke akun mana pun.
      </div>
    </div>
  );
}
