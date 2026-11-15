import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Masuk" };

function safeNext(value?: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/booth";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/booth");
  const params = await searchParams;

  return (
    <AuthLayout
      eyebrow="Selamat datang kembali"
      title="Masuk ke SnapBooth"
      subtitle="Lanjutkan momenmu, lihat riwayat unduhan, dan simpan photo strip baru."
    >
      <AuthForm mode="login" nextPath={safeNext(params.next)} />
    </AuthLayout>
  );
}
