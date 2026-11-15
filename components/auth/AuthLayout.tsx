import Link from "next/link";
import type { ReactNode } from "react";
import { HeartIcon, SparklesIcon } from "@/components/icons";

export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="page-shell py-10 sm:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-white/80 bg-white/70 shadow-[0_40px_120px_-60px_rgba(90,31,49,0.55)] lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative hidden min-h-[620px] flex-col justify-between overflow-hidden bg-maroon p-10 text-white lg:flex">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-pink/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-[#e7c47d]/20 blur-3xl" />
          <div className="relative">
            <span className="badge border border-white/20 bg-white/10 text-pink">
              <SparklesIcon className="mr-1.5 h-3.5 w-3.5" />
              SnapBooth moments
            </span>
            <h2 className="mt-6 font-display text-4xl leading-tight">
              Setiap momen
              <br />
              layak dirayakan.
            </h2>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/65">
              Simpan photo strip, temukan lagi di gallery, dan unduh kapan pun kamu rindu.
            </p>
          </div>

          <div className="relative mx-auto my-8 w-40 -rotate-3 rounded-2xl bg-white p-2 shadow-2xl">
            <img src="/seed/strip-demo.svg" alt="Contoh photo strip" className="w-full rounded-xl" />
          </div>

          <div className="relative flex items-center gap-3 text-xs text-white/55">
            <HeartIcon className="h-4 w-4 text-pink" />
            Dibuat untuk momen kecil yang berarti.
          </div>
        </aside>

        <div className="p-6 sm:p-10 lg:p-12">
          <Link href="/" className="text-sm font-semibold text-plum/60 hover:text-maroon">
            ← Kembali ke beranda
          </Link>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-rose">{eyebrow}</p>
          <h1 className="mt-3 font-display text-3xl text-maroon sm:text-4xl">{title}</h1>
          <p className="muted mt-3">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}
