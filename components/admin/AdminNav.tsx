"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";

const items = [
  { href: "/admin", label: "Ringkasan", exact: true },
  { href: "/admin/frames", label: "Frame" },
  { href: "/admin/filters", label: "Filter" },
  { href: "/admin/users", label: "Pengguna" },
  { href: "/admin/sessions", label: "Sesi Foto" },
  { href: "/admin/photos", label: "Foto" },
  { href: "/admin/strips", label: "Photo Strip" },
  { href: "/admin/downloads", label: "Unduhan" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto pb-2 lg:sticky lg:top-28 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0" aria-label="Navigasi dashboard admin">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition lg:block",
              active ? "bg-maroon text-white shadow-sm" : "text-plum/70 hover:bg-white hover:text-maroon",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
