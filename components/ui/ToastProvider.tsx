"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; message: string; kind: ToastKind };

type ToastContextValue = {
  showToast: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId++;
    setItems((current) => [...current, { id, message, kind }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[80] flex flex-col items-center gap-2 sm:left-auto sm:items-end"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={[
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl backdrop-blur",
              item.kind === "success"
                ? "border-emerald-200 bg-emerald-50/95 text-emerald-900"
                : item.kind === "error"
                  ? "border-rose-200 bg-rose-50/95 text-rose-900"
                  : "border-blush bg-white/95 text-maroon",
            ].join(" ")}
          >
            <span
              className={[
                "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold",
                item.kind === "success"
                  ? "bg-emerald-600 text-white"
                  : item.kind === "error"
                    ? "bg-rose-600 text-white"
                    : "bg-pink text-maroon",
              ].join(" ")}
              aria-hidden="true"
            >
              {item.kind === "success" ? "✓" : item.kind === "error" ? "!" : "i"}
            </span>
            <span className="leading-relaxed">{item.message}</span>
            <button
              type="button"
              onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
              className="ml-auto rounded-full px-1 text-lg leading-none opacity-60 transition hover:opacity-100"
              aria-label="Tutup notifikasi"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast harus digunakan di dalam ToastProvider");
  return value;
}
