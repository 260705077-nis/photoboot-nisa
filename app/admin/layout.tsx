import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { getCurrentUser } from "@/lib/auth";
import { SparklesIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard Admin",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/");

  return (
    <div className="page-shell py-8 sm:py-10">
      <div className="flex flex-col gap-4 border-b border-blush/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="badge bg-blush/60 text-maroon">
            <SparklesIcon className="mr-1.5 h-3.5 w-3.5" />
            Dashboard admin
          </span>
          <h1 className="mt-3 text-3xl tracking-tight text-maroon sm:text-4xl">Kelola SnapBooth</h1>
        </div>
        <p className="text-sm text-plum/60">
          Masuk sebagai <span className="font-semibold text-maroon">{user.name}</span>
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr] lg:gap-8">
        <aside className="min-w-0">
          <AdminNav />
          <div className="mt-6 hidden rounded-2xl border border-blush/60 bg-white/60 p-4 text-xs leading-relaxed text-plum/55 lg:block">
            Perubahan langsung tersimpan ke database. Hapus hanya data yang benar-benar tidak diperlukan.
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
