"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { AuthUser } from "@/lib/types";
import { cn } from "@/lib/format";

const links = [
  { href: "/", label: "Beranda" },
  { href: "/booth", label: "Photo Booth" },
  { href: "/gallery", label: "Gallery" },
  { href: "/history", label: "Riwayat Unduhan" },
];

export function SiteHeader({ user }: { user: AuthUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/70 bg-cream/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-20 lg:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40"
          aria-label="SnapBooth, ke beranda"
        >
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-maroon text-white shadow-lg shadow-maroon/20 transition group-hover:-rotate-3 group-hover:bg-plum">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 8.5h3l1.5-2h7L17 8.5h3v10H4z" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="3.2" />
              <path d="M17.8 11.2h.01" strokeLinecap="round" />
            </svg>
          </span>
          <span className="font-display text-xl tracking-tight text-maroon sm:text-2xl">SnapBooth</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40",
                isActive(link.href)
                  ? "bg-white text-maroon shadow-sm"
                  : "text-plum/70 hover:bg-white/70 hover:text-maroon",
              )}
            >
              {link.label}
            </Link>
          ))}
          {user?.role === "ADMIN" ? (
            <Link
              href="/admin"
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40",
                pathname.startsWith("/admin")
                  ? "bg-white text-maroon shadow-sm"
                  : "text-plum/70 hover:bg-white/70 hover:text-maroon",
              )}
            >
              Dashboard
            </Link>
          ) : null}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <>
              <span className="max-w-36 truncate rounded-full bg-white/70 px-3 py-2 text-xs font-semibold text-maroon">
                Hai, {user.name.split(" ")[0]}
              </span>
              <button
                type="button"
                onClick={logout}
                disabled={loggingOut}
                className="btn btn-ghost px-3 py-2 text-sm"
              >
                {loggingOut ? "Keluar…" : "Keluar"}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost px-3 py-2">
                Masuk
              </Link>
              <Link href="/register" className="btn btn-primary px-4 py-2">
                Daftar
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="grid h-11 w-11 place-items-center rounded-full border border-blush bg-white text-maroon lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={open ? "Tutup menu" : "Buka menu"}
        >
          <span className="relative block h-4 w-5" aria-hidden="true">
            <span
              className={cn(
                "absolute left-0 top-0 h-0.5 w-5 rounded bg-current transition",
                open && "translate-y-[7px] rotate-45",
              )}
            />
            <span
              className={cn(
                "absolute left-0 top-[7px] h-0.5 w-5 rounded bg-current transition",
                open && "opacity-0",
              )}
            />
            <span
              className={cn(
                "absolute left-0 top-[14px] h-0.5 w-5 rounded bg-current transition",
                open && "-translate-y-[7px] -rotate-45",
              )}
            />
          </span>
        </button>
      </div>

      {open ? (
        <div id="mobile-navigation" className="border-t border-blush/60 bg-cream px-4 pb-5 pt-2 lg:hidden">
          <nav className="grid gap-1" aria-label="Navigasi mobile">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm font-medium",
                  isActive(link.href) ? "bg-white text-maroon shadow-sm" : "text-plum/80",
                )}
              >
                {link.label}
              </Link>
            ))}
            {user?.role === "ADMIN" ? (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-3 text-sm font-medium text-plum/80"
              >
                Dashboard
              </Link>
            ) : null}
          </nav>
          <div className="mt-3 flex gap-2 border-t border-blush/60 pt-3">
            {user ? (
              <>
                <span className="flex-1 self-center truncate text-sm font-semibold text-maroon">
                  {user.name}
                </span>
                <button type="button" onClick={logout} className="btn btn-secondary px-4 py-2" disabled={loggingOut}>
                  {loggingOut ? "Keluar…" : "Keluar"}
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="btn btn-secondary flex-1">
                  Masuk
                </Link>
                <Link href="/register" onClick={() => setOpen(false)} className="btn btn-primary flex-1">
                  Daftar
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
