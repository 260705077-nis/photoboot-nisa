import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: {
    default: "SnapBooth — Photo Booth Online",
    template: "%s · SnapBooth",
  },
  description:
    "Photo booth online yang estetik: ambil foto dengan kamera, pilih frame dan filter, lalu unduh photo strip favoritmu.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  return (
    <html lang="id">
      <body>
        <ToastProvider>
          <SiteHeader user={user} />
          <main>{children}</main>
          <SiteFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
