import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Daftar" };

function safeNext(value?: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/booth";
  return value;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/booth");
  const params = await searchParams;

  return (
    <AuthLayout
      eyebrow="Buat akun gratis"
      title="Mulai koleksi momen"
      subtitle="Akun membuat photo strip dan riwayat unduhanmu lebih mudah ditemukan kembali."
    >
      <AuthForm mode="register" nextPath={safeNext(params.next)} />
    </AuthLayout>
  );
}
