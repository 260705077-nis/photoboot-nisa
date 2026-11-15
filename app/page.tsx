import Link from "next/link";
import type { Metadata } from "next";
import { db, type RowDataPacket } from "@/lib/db";
import { mapFrame, mapStrip } from "@/lib/mappers";
import type { Frame, PhotoStrip } from "@/lib/types";
import { formatShortDate } from "@/lib/format";
import {
  ArrowRightIcon,
  CameraIcon,
  DownloadIcon,
  FrameIcon,
  GridIcon,
  HeartIcon,
  SparklesIcon,
  TimerIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SnapBooth — Photo Booth Online Estetik",
  description:
    "Ambil foto langsung dari kamera, pilih frame dan filter, lalu unduh photo strip 3–4 foto. Gratis dan tanpa aplikasi.",
};

type LandingData = {
  frames: Frame[];
  strips: PhotoStrip[];
  completedSessions: number;
  activeFilters: number;
};

async function getLandingData(): Promise<LandingData> {
  try {
    const [frameRows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM frames WHERE is_active = 1 ORDER BY sort_order ASC, id ASC LIMIT 4",
    );
    const [stripRows] = await db.query<RowDataPacket[]>(
      `SELECT ps.*, s.session_code, u.name AS user_name, f.name AS frame_name, fl.name AS filter_name
       FROM photo_strips ps
       JOIN photo_sessions s ON s.id = ps.session_id
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN frames f ON f.id = ps.frame_id
       LEFT JOIN filters fl ON fl.id = ps.filter_id
       WHERE ps.is_public = 1
       ORDER BY ps.created_at DESC LIMIT 3`,
    );
    const [[sessionCount]] = await db.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM photo_sessions WHERE status = 'COMPLETED'",
    );
    const [[filterCount]] = await db.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM filters WHERE is_active = 1",
    );
    return {
      frames: frameRows.map(mapFrame),
      strips: stripRows.map(mapStrip),
      completedSessions: Number(sessionCount.total),
      activeFilters: Number(filterCount.total),
    };
  } catch {
    return { frames: [], strips: [], completedSessions: 0, activeFilters: 0 };
  }
}

const features = [
  {
    icon: CameraIcon,
    title: "Kamera langsung",
    text: "Gunakan kamera laptop atau HP tanpa aplikasi tambahan. Cukup izinkan akses kamera dan mulai berpose.",
  },
  {
    icon: TimerIcon,
    title: "Countdown playful",
    text: "Hitungan 3, 2, 1 memberi waktu untuk siap. Ambil 3 atau 4 foto sesuai frame pilihanmu.",
  },
  {
    icon: FrameIcon,
    title: "Frame & filter",
    text: "Pilih bingkai pink, maroon, floral, atau retro. Tambahkan filter lembut sebelum menyimpan.",
  },
  {
    icon: DownloadIcon,
    title: "Unduh & gallery",
    text: "Photo strip otomatis tersimpan. Unduh kapan saja dan temukan kembali di gallery publik.",
  },
];

const steps = [
  {
    number: "01",
    title: "Nyalakan kamera",
    text: "Buka Photo Booth, pilih jumlah foto, frame, dan filter favoritmu.",
  },
  {
    number: "02",
    title: "Beri pose terbaik",
    text: "Ikuti countdown untuk setiap foto. Ulangi foto mana pun yang belum pas.",
  },
  {
    number: "03",
    title: "Simpan & unduh",
    text: "Photo strip digabung otomatis. Unduh hasilnya atau bagikan lewat gallery.",
  },
];

export default async function HomePage() {
  const data = await getLandingData();

  return (
    <div className="overflow-hidden">
      <section className="relative">
        <div className="pointer-events-none absolute -left-24 top-28 h-72 w-72 rounded-full bg-pink/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-10 h-56 w-56 rounded-full bg-white blur-2xl" />
        <div className="page-shell relative grid items-center gap-12 pb-16 pt-10 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:pb-24 lg:pt-20">
          <div className="animate-fade-up">
            <span className="badge border border-pink/60 bg-white/80 px-3 py-1.5 text-maroon shadow-sm">
              <SparklesIcon className="mr-1.5 h-3.5 w-3.5" />
              Photo booth online · gratis
            </span>
            <h1 className="mt-6 max-w-2xl text-4xl leading-[1.05] tracking-tight text-maroon sm:text-6xl lg:text-7xl">
              Momen kecil,
              <br />
              <span className="italic text-rose">kenangan</span> yang tinggal.
            </h1>
            <p className="muted mt-6 max-w-xl text-base sm:text-lg">
              Pose, tertawa, dan abadikan hari ini dalam photo strip bergaya. Ambil foto langsung dari
              browser, pilih frame dan filter, lalu unduh hasilnya.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/booth" className="btn btn-primary px-7 py-3.5">
                <CameraIcon className="h-5 w-5" />
                Mulai Photo Booth
              </Link>
              <Link href="/gallery" className="btn btn-secondary px-6 py-3.5">
                Lihat Gallery
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/80 bg-white/65 px-4 py-3 backdrop-blur">
                <dt className="text-[11px] uppercase tracking-[0.16em] text-plum/55">Frame</dt>
                <dd className="mt-1 font-display text-2xl text-maroon">{data.frames.length || 4}</dd>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/65 px-4 py-3 backdrop-blur">
                <dt className="text-[11px] uppercase tracking-[0.16em] text-plum/55">Filter</dt>
                <dd className="mt-1 font-display text-2xl text-maroon">{data.activeFilters || 4}</dd>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/65 px-4 py-3 backdrop-blur">
                <dt className="text-[11px] uppercase tracking-[0.16em] text-plum/55">Momen</dt>
                <dd className="mt-1 font-display text-2xl text-maroon">{data.completedSessions}</dd>
              </div>
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-lg">
            <div className="absolute inset-8 rounded-full bg-pink/30 blur-3xl" aria-hidden="true" />
            <div className="relative mx-auto w-[260px] animate-floaty sm:w-[300px] lg:w-[330px]">
              <span className="absolute -left-7 top-16 -rotate-12 rounded-md bg-gold/80 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-maroon shadow-sm">
                snap!
              </span>
              <span className="absolute -right-6 bottom-24 rotate-6 rounded-md bg-white/90 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-rose shadow-sm">
                stay cute
              </span>
              <div className="rotate-2 rounded-[2rem] border border-white bg-white/85 p-3 shadow-[0_35px_80px_-40px_rgba(90,31,49,0.7)]">
                <img
                  src="/seed/strip-demo.svg"
                  alt="Contoh photo strip SnapBooth berisi empat foto"
                  className="w-full rounded-[1.4rem]"
                />
              </div>
              <div className="absolute -bottom-5 -left-3 flex items-center gap-2 rounded-2xl border border-pink/40 bg-cream px-3 py-2 text-xs font-semibold text-maroon shadow-lg">
                <HeartIcon className="h-4 w-4 text-rose" />
                4 foto · 1 strip
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-blush/50 bg-white/45 py-6">
        <div className="no-scrollbar flex items-center gap-8 overflow-x-auto px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-plum/45 sm:justify-center sm:px-6">
          <span>Ambil foto</span>
          <span className="text-pink">✦</span>
          <span>Pilih frame</span>
          <span className="text-pink">✦</span>
          <span>Tambah filter</span>
          <span className="text-pink">✦</span>
          <span>Simpan kenangan</span>
          <span className="text-pink">✦</span>
          <span>Ulangi sesuka hati</span>
        </div>
      </section>

      <section className="page-shell py-16 sm:py-20">
        <div className="max-w-2xl">
          <span className="badge bg-blush/60 text-maroon">Kenapa SnapBooth</span>
          <h2 className="section-title mt-4">Sederhana, playful, dan tetap estetik.</h2>
          <p className="muted mt-3">
            Semua yang kamu butuhkan untuk sesi photo booth yang menyenangkan, langsung di browser.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="card group p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_35px_90px_-48px_rgba(90,31,49,0.65)]"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blush/60 text-maroon transition group-hover:bg-maroon group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-xl text-maroon">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-plum/70">{feature.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-maroon py-16 text-white sm:py-20">
        <div className="page-shell">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <span className="badge bg-white/10 text-pink">Frame pilihan</span>
              <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
                Pilih bingkai yang paling kamu.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/65">
                Dari pink klasik sampai maroon elegan — setiap frame punya kepribadian sendiri.
              </p>
            </div>
            <Link href="/booth" className="btn border border-white/30 bg-white/10 text-white hover:bg-white/15">
              Coba semua frame
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {data.frames.length > 0 ? (
              data.frames.map((frame) => (
                <Link
                  key={frame.id}
                  href="/booth"
                  className="group rounded-3xl border border-white/10 bg-white/5 p-3 transition hover:-translate-y-1 hover:bg-white/10"
                >
                  <div className="flex h-64 items-center justify-center overflow-hidden rounded-2xl bg-[#ffeef4] p-3 sm:h-72">
                    <img
                      src={frame.imageUrl}
                      alt={`Frame ${frame.name}`}
                      className="h-full w-auto object-contain transition duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="px-1 pb-1 pt-3">
                    <p className="font-display text-lg">{frame.name}</p>
                    <p className="text-xs text-white/50">{frame.slotCount} foto · {frame.description}</p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="col-span-full rounded-3xl border border-white/15 bg-white/5 p-6 text-sm text-white/60">
                Frame akan tampil di sini setelah ditambahkan dari dashboard admin.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="page-shell py-16 sm:py-20">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="badge bg-blush/60 text-maroon">Cara kerja</span>
            <h2 className="section-title mt-4">Tiga langkah, satu strip.</h2>
          </div>
          <p className="muted max-w-sm">
            Tidak perlu install apa pun. Kamu hanya perlu kamera dan sedikit keberanian untuk berpose.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map((step) => (
            <article key={step.number} className="relative overflow-hidden rounded-3xl border border-blush/60 bg-white/75 p-7">
              <span className="absolute -right-1 -top-3 font-display text-8xl text-blush/60" aria-hidden="true">
                {step.number}
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose">Langkah {step.number}</p>
              <h3 className="relative mt-12 font-display text-2xl text-maroon">{step.title}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-plum/70">{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="page-shell pb-16 sm:pb-20">
        <div className="rounded-[2rem] border border-blush/60 bg-white/60 p-6 sm:p-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="badge bg-blush/60 text-maroon">
                <GridIcon className="mr-1.5 h-3.5 w-3.5" />
                Gallery terbaru
              </span>
              <h2 className="section-title mt-4">Momen yang sudah dibagikan.</h2>
            </div>
            <Link href="/gallery" className="btn btn-secondary">
              Buka Gallery
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          {data.strips.length > 0 ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.strips.map((strip) => (
                <Link
                  key={strip.id}
                  href="/gallery"
                  className="group flex gap-4 rounded-2xl border border-blush/60 bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="h-36 w-24 shrink-0 overflow-hidden rounded-xl bg-blush/30">
                    <img
                      src={strip.imageUrl}
                      alt={strip.caption ?? "Photo strip SnapBooth"}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="min-w-0 self-center">
                    <p className="truncate font-display text-lg text-maroon">
                      {strip.caption || "Untitled moment"}
                    </p>
                    <p className="mt-1 text-xs text-plum/55">
                      {strip.userName ?? "Tamu SnapBooth"} · {formatShortDate(strip.createdAt)}
                    </p>
                    <p className="mt-3 text-xs font-semibold text-rose">{strip.frameName ?? "Frame SnapBooth"}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-pink/60 bg-cream/60 px-6 py-12 text-center">
              <p className="font-display text-2xl text-maroon">Gallery masih menunggu momen pertamamu.</p>
              <p className="muted mx-auto mt-2 max-w-md">Jadilah yang pertama mengisi gallery dengan photo strip.</p>
              <Link href="/booth" className="btn btn-primary mt-5">
                Ambil foto pertama
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="page-shell pb-20">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-blush via-[#ffe8f0] to-[#f6c7d9] px-6 py-14 text-center sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute -left-10 top-4 h-40 w-40 rounded-full border border-white/60" />
          <div className="pointer-events-none absolute -bottom-14 right-6 h-52 w-52 rounded-full bg-white/30 blur-2xl" />
          <HeartIcon className="mx-auto h-8 w-8 text-rose" />
          <h2 className="relative mx-auto mt-5 max-w-2xl font-display text-4xl leading-tight text-maroon sm:text-5xl">
            Siap bikin kenangan hari ini?
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-sm leading-relaxed text-plum/70 sm:text-base">
            Nyalakan kamera, berpose, dan biarkan SnapBooth merangkai momennya untukmu.
          </p>
          <Link href="/booth" className="btn btn-primary relative mt-8 px-8 py-3.5">
            <CameraIcon className="h-5 w-5" />
            Mulai sekarang
          </Link>
        </div>
      </section>
    </div>
  );
}
