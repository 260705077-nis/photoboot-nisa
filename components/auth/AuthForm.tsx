"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useToast } from "@/components/ui/ToastProvider";

type Mode = "login" | "register";

export function AuthForm({ mode, nextPath }: { mode: Mode; nextPath: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  function validate(): boolean {
    const nextErrors: Record<string, string[]> = {};
    if (isRegister && name.trim().length < 2) {
      nextErrors.name = ["Nama minimal 2 karakter."];
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = ["Masukkan email yang valid."];
    }
    if (isRegister && password.length < 8) {
      nextErrors.password = ["Password minimal 8 karakter."];
    }
    if (!isRegister && password.length === 0) {
      nextErrors.password = ["Password wajib diisi."];
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister ? { name, email, password } : { email, password }),
      });
      const payload = (await response.json()) as {
        error?: string;
        details?: { fieldErrors?: Record<string, string[]> };
      };

      if (!response.ok) {
        setErrors(payload.details?.fieldErrors ?? {});
        setMessage(payload.error ?? "Terjadi kesalahan. Coba lagi.");
        return;
      }

      showToast(isRegister ? "Akun berhasil dibuat. Selamat datang!" : "Berhasil masuk. Selamat datang kembali!", "success");
      router.push(nextPath);
      router.refresh();
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi internetmu.");
    } finally {
      setLoading(false);
    }
  }

  function fieldError(field: string) {
    const messages = errors[field];
    if (!messages?.length) return null;
    return (
      <p id={`${field}-error`} className="mt-1.5 text-xs font-medium text-rose-700">
        {messages[0]}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {message ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {message}
        </div>
      ) : null}

      {isRegister ? (
        <div>
          <label htmlFor="name" className="label">
            Nama
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="input"
            placeholder="Nama panggilanmu"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
            required
          />
          {fieldError("name")}
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="input"
          placeholder="kamu@email.com"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          required
        />
        {fieldError("email")}
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input pr-24"
            placeholder={isRegister ? "Minimal 8 karakter" : "Password kamu"}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-xs font-semibold text-plum/60 hover:bg-blush/40 hover:text-maroon"
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
          >
            {showPassword ? "Sembunyikan" : "Tampilkan"}
          </button>
        </div>
        {fieldError("password")}
      </div>

      <button type="submit" disabled={loading} className="btn btn-primary w-full py-3">
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            Memproses…
          </>
        ) : isRegister ? (
          "Buat akun"
        ) : (
          "Masuk"
        )}
      </button>

      <p className="pt-1 text-center text-sm text-plum/70">
        {isRegister ? "Sudah punya akun? " : "Belum punya akun? "}
        <Link
          href={isRegister ? `/login?next=${encodeURIComponent(nextPath)}` : `/register?next=${encodeURIComponent(nextPath)}`}
          className="font-semibold text-maroon underline decoration-pink decoration-2 underline-offset-4"
        >
          {isRegister ? "Masuk" : "Daftar gratis"}
        </Link>
      </p>
    </form>
  );
}
