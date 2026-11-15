import type { Metadata } from "next";
import Link from "next/link";
import { db, type RowDataPacket } from "@/lib/db";
import { formatShortDate } from "@/lib/format";
import { CameraIcon, DownloadIcon, FrameIcon, GridIcon, HeartIcon, SparklesIcon, TimerIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Ringkasan Admin" };

async function counts() {
  const tables = ["users", "frames", "filters", "photo_sessions", "photos", "photo_strips", "downloads"];
  const result: Record<string, number> = {};
  for (const table of tables) {
    const [[row]] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM \`${table}\``);
    result[table] = Number(row.total);
  }
  return result;
}

export default async function AdminPage() {
  let stats: Record<string, number> = {};
  let recent: RowDataPacket[] = [];
  let errorMessage: string | null = null;
  try {
    stats = await counts();
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT ps.id, ps.caption, ps.image_url, ps.is_public, ps.created_at, u.name AS user_name
       FROM photo_strips ps JOIN photo_sessions s ON s.id = ps.session_id
       LEFT JOIN users u ON u.id = s.user_id
       ORDER BY ps.created_at DESC LIMIT 5`,
    );
    recent = rows;
  } catch {
    errorMessage = "Data dashboard tidak dapat dimuat. Periksa koneksi database.";
  }

  const cards = [
    { label: "Pengguna", value: stats.users ?? 0, href: "/admin/users", icon: HeartIcon },
    { label: "Sesi foto", value: stats.photo_sessions ?? 0, href: "/admin/sessions", icon: TimerIcon },
    { label: "Foto", value: stats.photos ?? 0, href: "/admin/photos", icon: CameraIcon },
    { label: "Photo strip", value: stats.photo_strips ?? 0, href: "/admin/strips", icon: GridIcon },
    { label: "Unduhan", value: stats.downloads ?? 0, href: "/admin/downloads", icon: DownloadIcon },
    { label: "Frame", value: stats.frames ?? 0, href: "/admin/frames", icon: FrameIcon },
  ];

  return (
    <div>
      {errorMessage ? (
        <div role="alert" className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="card group p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-blush/60 text-maroon transition group-hover:bg-maroon group-hover:text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-xs text-plum/40">Lihat</span>
              </div>
              <p className="mt-5 font-display text-4xl text-maroon">{card.value}</p>
              <p className="mt-1 text-sm text-plum/60">{card.label}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose">Terbaru</p>
              <h2 className="mt-1 font-display text-2xl text-maroon">Photo strip terakhir</h2>
            </div>
            <Link href="/admin/strips" className="text-sm font-semibold text-plum/60 hover:text-maroon">
              Semua →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-blush px-4 py-8 text-center text-sm text-plum/50">
              Belum ada photo strip.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {recent.map((strip) => (
                <div key={Number(strip.id)} className="flex items-center gap-3 rounded-2xl border border-blush/50 bg-white p-2.5">
                  <img src={String(strip.image_url)} alt="" className="h-16 w-12 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-maroon">{String(strip.caption || "Untitled moment")}</p>
                    <p className="mt-1 text-xs text-plum/50">
                      {String(strip.user_name || "Tamu")} · {formatShortDate(String(strip.created_at))}
                    </p>
                  </div>
                  <span className={`badge ${strip.is_public ? "bg-emerald-50 text-emerald-700" : "bg-blush/50 text-plum/60"}`}>
                    {strip.is_public ? "Publik" : "Privat"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose">Akses cepat</p>
          <h2 className="mt-1 font-display text-2xl text-maroon">Tambah konten</h2>
          <div className="mt-5 space-y-2">
            <Link href="/admin/frames" className="flex items-center justify-between rounded-2xl border border-blush/60 bg-white px-4 py-3 text-sm font-semibold text-maroon hover:bg-blush/20">
              Tambah frame <span aria-hidden="true">→</span>
            </Link>
            <Link href="/admin/filters" className="flex items-center justify-between rounded-2xl border border-blush/60 bg-white px-4 py-3 text-sm font-semibold text-maroon hover:bg-blush/20">
              Tambah filter <span aria-hidden="true">→</span>
            </Link>
            <Link href="/admin/users" className="flex items-center justify-between rounded-2xl border border-blush/60 bg-white px-4 py-3 text-sm font-semibold text-maroon hover:bg-blush/20">
              Kelola pengguna <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="mt-5 rounded-2xl bg-maroon p-4 text-white">
            <SparklesIcon className="h-5 w-5 text-pink" />
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Frame dan filter aktif otomatis muncul di halaman Photo Booth.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
