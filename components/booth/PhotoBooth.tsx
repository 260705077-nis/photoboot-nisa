"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CameraIcon, DownloadIcon, FrameIcon, GridIcon, RefreshIcon, SparklesIcon } from "@/components/icons";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/format";
import type { AuthUser, Filter, Frame, PhotoStrip } from "@/lib/types";

type Phase = "setup" | "camera" | "capturing" | "review" | "result";

const STRIP_LAYOUTS = {
  4: { width: 600, height: 1900, top: 100, slotHeight: 380, gap: 24, side: 40, radius: 22 },
  3: { width: 600, height: 1580, top: 100, slotHeight: 400, gap: 24, side: 40, radius: 26 },
} as const;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:\/\//i.test(src)) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Gambar tidak dapat dimuat."));
    image.src = src;
  });
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  let sourceX = 0;
  let sourceY = 0;

  if (imageRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Permintaan gagal.");
  return payload.data as T;
}

export function PhotoBooth({
  frames,
  filters,
  user,
}: {
  frames: Frame[];
  filters: Filter[];
  user: AuthUser | null;
}) {
  const { showToast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelRef = useRef(false);
  const runningRef = useRef(false);

  const initialCount: 3 | 4 = frames.some((frame) => frame.slotCount === 4) ? 4 : 3;
  const [phase, setPhase] = useState<Phase>("setup");
  const [photoCount, setPhotoCount] = useState<3 | 4>(initialCount);
  const [frameId, setFrameId] = useState<number | null>(
    frames.find((frame) => frame.slotCount === initialCount)?.id ?? frames[0]?.id ?? null,
  );
  const [filterId, setFilterId] = useState<number | null>(filters[0]?.id ?? null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stripPreview, setStripPreview] = useState<string | null>(null);
  const [savedStrip, setSavedStrip] = useState<PhotoStrip | null>(null);
  const [caption, setCaption] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const selectedFrame = frames.find((frame) => frame.id === frameId) ?? null;
  const selectedFilter = filters.find((filter) => filter.id === filterId) ?? null;
  const matchingFrames = frames.filter((frame) => frame.slotCount === photoCount);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  useEffect(() => {
    return () => {
      cancelRef.current = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraReady(true);
      return;
    }

    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Browser ini tidak mendukung akses kamera. Gunakan Chrome, Safari, atau Edge terbaru.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraReady(true);
    } catch (cameraFailure) {
      const errorName = cameraFailure instanceof DOMException ? cameraFailure.name : "";
      if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
        setCameraError("Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser lalu coba lagi.");
      } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
        setCameraError("Kamera tidak ditemukan. Pastikan kamera terpasang dan tidak sedang dipakai aplikasi lain.");
      } else if (errorName === "NotReadableError") {
        setCameraError("Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.");
      } else {
        setCameraError("Kamera tidak dapat diakses. Pastikan koneksi aman (HTTPS atau localhost) dan izin kamera aktif.");
      }
    }
  }, []);

  useEffect(() => {
    if (phase !== "camera" && phase !== "capturing") return;
    // Kamera adalah external system; sinkronisasi stream memang memicu state UI.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void startCamera();
  }, [phase, startCamera]);

  function choosePhotoCount(count: 3 | 4) {
    setPhotoCount(count);
    if (selectedFrame?.slotCount !== count) {
      setFrameId(frames.find((frame) => frame.slotCount === count)?.id ?? null);
    }
    setPhotos([]);
    setStripPreview(null);
    setSavedStrip(null);
    setPhase("setup");
  }

  function captureFrame(): string | null {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) return null;

    const width = 900;
    const height = 675;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;

    const sourceRatio = video.videoWidth / video.videoHeight;
    const targetRatio = width / height;
    let sourceWidth = video.videoWidth;
    let sourceHeight = video.videoHeight;
    let sourceX = 0;
    let sourceY = 0;
    if (sourceRatio > targetRatio) {
      sourceWidth = video.videoHeight * targetRatio;
      sourceX = (video.videoWidth - sourceWidth) / 2;
    } else {
      sourceHeight = video.videoWidth / targetRatio;
      sourceY = (video.videoHeight - sourceHeight) / 2;
    }

    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    context.restore();
    return canvas.toDataURL("image/jpeg", 0.9);
  }

  async function runSequence(startIndex: number, single: boolean) {
    if (runningRef.current) return;
    runningRef.current = true;
    cancelRef.current = false;
    setError(null);
    setPhase("capturing");
    await sleep(150);

    const end = single ? startIndex + 1 : photoCount;
    for (let index = startIndex; index < end; index += 1) {
      setActiveIndex(index);
      for (let value = 3; value >= 1; value -= 1) {
        if (cancelRef.current) {
          runningRef.current = false;
          return;
        }
        setCountdown(value);
        await sleep(1000);
      }
      if (cancelRef.current) {
        runningRef.current = false;
        return;
      }

      setCountdown(null);
      const data = captureFrame();
      if (!data) {
        runningRef.current = false;
        setCameraError("Kamera belum siap. Tunggu sebentar lalu coba lagi.");
        setPhase("camera");
        return;
      }
      setPhotos((current) => {
        const next = [...current];
        next[index] = data;
        return next;
      });
      setFlash(true);
      await sleep(160);
      setFlash(false);
      await sleep(550);
    }

    setCountdown(null);
    runningRef.current = false;
    setPhase("review");
  }

  async function buildStrip() {
    if (!selectedFrame || !selectedFilter) return;
    if (photos.filter(Boolean).length !== photoCount) {
      setError("Jumlah foto belum lengkap.");
      return;
    }

    setBuilding(true);
    setError(null);
    try {
      const [frameImage, ...photoImages] = await Promise.all([
        loadImage(selectedFrame.imageUrl),
        ...photos.map((photo) => loadImage(photo)),
      ]);
      const layout = STRIP_LAYOUTS[photoCount];
      const canvas = document.createElement("canvas");
      canvas.width = layout.width;
      canvas.height = layout.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas tidak tersedia.");

      context.fillStyle = "#fffafc";
      context.fillRect(0, 0, layout.width, layout.height);

      photoImages.forEach((image, index) => {
        const x = layout.side;
        const y = layout.top + index * (layout.slotHeight + layout.gap);
        context.save();
        roundedRect(context, x, y, layout.width - layout.side * 2, layout.slotHeight, layout.radius);
        context.clip();
        context.filter = selectedFilter.cssFilter === "none" ? "none" : selectedFilter.cssFilter;
        drawCover(context, image, x, y, layout.width - layout.side * 2, layout.slotHeight);
        context.restore();
      });

      context.filter = "none";
      context.drawImage(frameImage, 0, 0, layout.width, layout.height);
      const result = canvas.toDataURL("image/png");
      setStripPreview(result);
      setPhase("result");
      stopCamera();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Photo strip gagal dibuat. Pastikan frame bisa dimuat, lalu coba lagi.");
    } finally {
      setBuilding(false);
    }
  }

  async function saveStrip() {
    if (!selectedFrame || !selectedFilter || !stripPreview) return;
    setSaving(true);
    setError(null);
    try {
      const session = await postJson<{ sessionCode: string }>("/api/photo-sessions", {
        frameId: selectedFrame.id,
        filterId: selectedFilter.id,
        photoCount,
      });

      for (let index = 0; index < photos.length; index += 1) {
        await postJson("/api/photos", {
          sessionCode: session.sessionCode,
          position: index + 1,
          dataUrl: photos[index],
        });
      }

      const strip = await postJson<PhotoStrip>("/api/photo-strips", {
        sessionCode: session.sessionCode,
        dataUrl: stripPreview,
        caption: caption.trim() || null,
        isPublic,
      });
      setSavedStrip(strip);
      showToast("Photo strip berhasil disimpan. Siap diunduh!", "success");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Photo strip gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  function resetAll() {
    cancelRef.current = true;
    runningRef.current = false;
    stopCamera();
    setPhase("setup");
    setPhotos([]);
    setCountdown(null);
    setActiveIndex(0);
    setStripPreview(null);
    setSavedStrip(null);
    setCaption("");
    setError(null);
    setCameraError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const step = phase === "setup" ? 1 : phase === "result" ? 3 : 2;

  return (
    <div className="page-shell py-8 sm:py-12">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="badge bg-blush/60 text-maroon">
            <SparklesIcon className="mr-1.5 h-3.5 w-3.5" />
            Photo booth
          </span>
          <h1 className="mt-4 text-4xl tracking-tight text-maroon sm:text-5xl">Siap, kamera, pose!</h1>
          <p className="muted mt-3 max-w-xl">
            Pilih gaya, ambil {photoCount} foto, lalu biarkan kami merangkainya menjadi satu photo strip.
          </p>
        </div>
        <ol className="flex flex-wrap items-center gap-2 text-xs font-semibold" aria-label="Tahapan photo booth">
          {[
            { number: 1, label: "Pilih gaya" },
            { number: 2, label: "Ambil foto" },
            { number: 3, label: "Simpan" },
          ].map((item) => (
            <li
              key={item.number}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-2",
                step === item.number
                  ? "border-maroon bg-maroon text-white"
                  : step > item.number
                    ? "border-pink/60 bg-white text-maroon"
                    : "border-blush bg-white/60 text-plum/50",
              )}
            >
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full text-[10px]",
                  step === item.number ? "bg-white/20" : "bg-blush/70",
                )}
              >
                {step > item.number ? "✓" : item.number}
              </span>
              {item.label}
            </li>
          ))}
        </ol>
      </div>

      {error ? (
        <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-semibold underline">
            Tutup
          </button>
        </div>
      ) : null}

      {phase === "setup" ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <section className="card p-5 sm:p-7">
              <div className="flex items-center gap-2 text-sm font-semibold text-maroon">
                <GridIcon className="h-4 w-4 text-rose" />
                1. Jumlah foto
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {([3, 4] as const).map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => choosePhotoCount(count)}
                    aria-pressed={photoCount === count}
                    className={cn(
                      "rounded-2xl border px-4 py-4 text-left transition focus-visible:ring-2 focus-visible:ring-maroon/40",
                      photoCount === count
                        ? "border-maroon bg-maroon text-white shadow-lg"
                        : "border-blush bg-white text-maroon hover:border-pink",
                    )}
                  >
                    <span className="font-display text-2xl">{count} foto</span>
                    <span className={cn("mt-1 block text-xs", photoCount === count ? "text-white/65" : "text-plum/55")}>
                      {count === 3 ? "Ringkas dan manis" : "Klasik photo strip"}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="card p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-maroon">
                  <FrameIcon className="h-4 w-4 text-rose" />
                  2. Pilih frame
                </div>
                <span className="text-xs text-plum/55">{matchingFrames.length} pilihan untuk {photoCount} foto</span>
              </div>
              {matchingFrames.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {matchingFrames.map((frame) => (
                    <button
                      key={frame.id}
                      type="button"
                      onClick={() => setFrameId(frame.id)}
                      aria-pressed={frameId === frame.id}
                      aria-label={`Pilih frame ${frame.name}`}
                      className={cn(
                        "rounded-2xl border p-2 text-left transition focus-visible:ring-2 focus-visible:ring-maroon/40",
                        frameId === frame.id
                          ? "border-maroon bg-blush/30 ring-2 ring-maroon/15"
                          : "border-blush bg-white hover:border-pink",
                      )}
                    >
                      <div className="flex h-40 items-center justify-center overflow-hidden rounded-xl bg-[#ffeef4] p-2">
                        <img src={frame.imageUrl} alt="" className="h-full w-auto object-contain" />
                      </div>
                      <p className="mt-2 truncate px-1 text-xs font-semibold text-maroon">{frame.name}</p>
                      <p className="truncate px-1 text-[10px] text-plum/50">{frame.slotCount} foto</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border border-dashed border-pink/60 bg-cream px-4 py-6 text-sm text-plum/60">
                  Belum ada frame untuk {photoCount} foto. Pilih jumlah lain atau tambahkan frame dari dashboard.
                </p>
              )}
            </section>

            <section className="card p-5 sm:p-7">
              <div className="flex items-center gap-2 text-sm font-semibold text-maroon">
                <SparklesIcon className="h-4 w-4 text-rose" />
                3. Pilih filter
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {filters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setFilterId(filter.id)}
                    aria-pressed={filterId === filter.id}
                    className={cn(
                      "rounded-2xl border p-2 text-left transition focus-visible:ring-2 focus-visible:ring-maroon/40",
                      filterId === filter.id
                        ? "border-maroon bg-blush/30 ring-2 ring-maroon/15"
                        : "border-blush bg-white hover:border-pink",
                    )}
                  >
                    <div className="overflow-hidden rounded-xl bg-blush/30">
                      <img
                        src="/seed/photo-1.svg"
                        alt=""
                        className="h-24 w-full object-cover"
                        style={{ filter: filter.cssFilter === "none" ? undefined : filter.cssFilter }}
                      />
                    </div>
                    <p className="mt-2 truncate px-1 text-xs font-semibold text-maroon">{filter.name}</p>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="card overflow-hidden">
              <div className="bg-gradient-to-br from-blush via-[#ffeaf2] to-[#f7c7d8] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-plum/55">Ringkasan sesi</p>
                {selectedFrame ? (
                  <div className="mt-4 flex justify-center rounded-2xl bg-white/40 p-3">
                    <img
                      src={selectedFrame.imageUrl}
                      alt={`Preview frame ${selectedFrame.name}`}
                      className="h-64 w-auto rounded-xl object-contain"
                    />
                  </div>
                ) : (
                  <div className="mt-4 grid h-40 place-items-center rounded-2xl border border-dashed border-white/70 bg-white/30 text-sm text-plum/50">
                    Pilih frame
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="badge bg-white/75 text-maroon">{photoCount} foto</span>
                  <span className="badge bg-white/75 text-maroon">{selectedFrame?.name ?? "Tanpa frame"}</span>
                  <span className="badge bg-white/75 text-maroon">{selectedFilter?.name ?? "Tanpa filter"}</span>
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm leading-relaxed text-plum/70">
                  {user
                    ? `Sesi ini akan tersimpan di akun ${user.name}.`
                    : "Kamu bisa mulai tanpa akun. Masuk agar riwayat unduhan tersimpan di akunmu."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedFrame || !selectedFilter) {
                      setError("Pilih frame dan filter terlebih dahulu.");
                      return;
                    }
                    setPhase("camera");
                  }}
                  disabled={!selectedFrame || !selectedFilter}
                  className="btn btn-primary mt-5 w-full py-3.5"
                >
                  <CameraIcon className="h-5 w-5" />
                  Nyalakan kamera
                </button>
                <p className="mt-3 text-center text-[11px] leading-relaxed text-plum/45">
                  Kamera hanya aktif saat sesi berlangsung. Tidak ada foto yang diambil diam-diam.
                </p>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {phase === "camera" || phase === "capturing" ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="card overflow-hidden">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-maroon">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                aria-label="Pratinjau kamera"
                className={cn("h-full w-full scale-x-[-1] object-cover", !cameraReady && "opacity-0")}
              />
              <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

              {!cameraReady && !cameraError ? (
                <div className="absolute inset-0 grid place-items-center bg-maroon text-center text-white">
                  <div>
                    <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <p className="mt-3 text-sm text-white/70">Menyalakan kamera…</p>
                  </div>
                </div>
              ) : null}

              {cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-maroon/95 p-6 text-center text-white">
                  <CameraIcon className="h-10 w-10 text-pink" />
                  <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/80">{cameraError}</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={() => void startCamera()} className="btn border border-white/30 bg-white/10 text-white">
                      Coba lagi
                    </button>
                    <button type="button" onClick={resetAll} className="btn border border-white/20 text-white">
                      Kembali
                    </button>
                  </div>
                </div>
              ) : null}

              {countdown ? (
                <div aria-live="assertive" className="absolute inset-0 grid place-items-center bg-maroon/20">
                  <span
                    key={countdown}
                    className="animate-fade-up font-display text-[7rem] leading-none text-white drop-shadow-[0_8px_20px_rgba(90,31,49,0.6)] sm:text-[10rem]"
                  >
                    {countdown}
                  </span>
                </div>
              ) : null}

              {flash ? <div className="absolute inset-0 animate-pulse bg-white" aria-hidden="true" /> : null}

              <div className="absolute left-4 top-4 flex gap-1.5">
                {Array.from({ length: photoCount }).map((_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "h-2 w-6 rounded-full transition",
                      photos[index] ? "bg-pink" : activeIndex === index ? "bg-white" : "bg-white/30",
                    )}
                  />
                ))}
              </div>

              <div className="absolute bottom-4 left-4 rounded-full bg-maroon/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                Foto {Math.min(activeIndex + 1, photoCount)} dari {photoCount}
              </div>
            </div>

            <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-maroon">
                  {phase === "capturing" ? "Siap-siap…" : cameraReady ? "Kamera siap!" : "Menunggu kamera"}
                </p>
                <p className="mt-1 text-xs text-plum/55">
                  {phase === "capturing" ? "Lihat ke kamera dan tersenyum." : "Klik mulai, lalu ikuti hitungan mundur."}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={resetAll} className="btn btn-secondary px-4 py-2">
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => void runSequence(0, false)}
                  disabled={!cameraReady || phase === "capturing"}
                  className="btn btn-primary px-5 py-2.5"
                >
                  <CameraIcon className="h-4 w-4" />
                  {phase === "capturing" ? "Mengambil foto…" : "Mulai ambil foto"}
                </button>
              </div>
            </div>
          </section>

          <aside className="card p-5">
            <p className="text-sm font-semibold text-maroon">Tips pose</p>
            <ul className="mt-3 space-y-3 text-sm leading-relaxed text-plum/70">
              <li>1. Posisikan wajah di tengah bingkai dan pastikan cahaya cukup.</li>
              <li>2. Ganti pose di setiap hitungan agar strip terlihat hidup.</li>
              <li>3. Jangan takut mengulang foto — hasil terbaik bisa dicoba lagi.</li>
            </ul>
            <div className="mt-5 rounded-2xl bg-blush/30 p-4 text-xs leading-relaxed text-plum/65">
              Setelah semua foto diambil, kamu bisa mengulang foto mana pun sebelum membuat strip.
            </div>
          </aside>
        </div>
      ) : null}

      {phase === "review" ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="card p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose">Review foto</p>
                <h2 className="mt-1 font-display text-2xl text-maroon">Sudah pas semua?</h2>
              </div>
              <span className="badge bg-blush/50 text-maroon">{photos.filter(Boolean).length}/{photoCount} foto</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {photos.map((photo, index) => (
                <div key={index} className="overflow-hidden rounded-2xl border border-blush bg-white">
                  <div className="relative aspect-[4/3] bg-blush/30">
                    <img
                      src={photo}
                      alt={`Foto ${index + 1}`}
                      className="h-full w-full object-cover"
                      style={{ filter: selectedFilter?.cssFilter === "none" ? undefined : selectedFilter?.cssFilter }}
                    />
                    <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-maroon text-[10px] font-bold text-white">
                      {index + 1}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void runSequence(index, true)}
                    className="flex w-full items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-semibold text-maroon hover:bg-blush/30"
                  >
                    <RefreshIcon className="h-3.5 w-3.5" />
                    Ulangi
                  </button>
                </div>
              ))}
            </div>
          </section>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="card p-5">
              <p className="font-display text-2xl text-maroon">Satu langkah lagi.</p>
              <p className="muted mt-2">Kami akan menggabungkan foto dengan frame dan filter pilihanmu.</p>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-blush/30 p-3">
                {selectedFrame ? <img src={selectedFrame.imageUrl} alt="" className="h-16 w-12 object-contain" /> : null}
                <div className="text-xs">
                  <p className="font-semibold text-maroon">{selectedFrame?.name}</p>
                  <p className="mt-1 text-plum/55">{selectedFilter?.name} · {photoCount} foto</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void buildStrip()}
                disabled={building || photos.filter(Boolean).length !== photoCount}
                className="btn btn-primary mt-5 w-full py-3.5"
              >
                {building ? "Membuat strip…" : "Buat Photo Strip"}
              </button>
              <button type="button" onClick={resetAll} className="btn btn-ghost mt-2 w-full">
                Mulai ulang
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {phase === "result" && stripPreview ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="card p-5 sm:p-7">
            <div className="rounded-[1.75rem] bg-gradient-to-br from-blush via-[#ffeef4] to-[#f7c7d8] p-5">
              <img
                src={stripPreview}
                alt="Hasil photo strip"
                className="mx-auto max-h-[70vh] w-auto rounded-2xl shadow-[0_30px_60px_-35px_rgba(90,31,49,0.6)]"
              />
            </div>
          </section>

          <section className="card p-5 sm:p-7">
            <span className="badge bg-blush/60 text-maroon">
              <SparklesIcon className="mr-1.5 h-3.5 w-3.5" />
              Hasil siap
            </span>
            <h2 className="mt-4 font-display text-3xl text-maroon">Cantik banget!</h2>
            <p className="muted mt-2">
              {savedStrip ? "Photo strip tersimpan. Kamu bisa mengunduhnya kapan saja dari gallery." : "Simpan ke gallery agar mudah ditemukan kembali, lalu unduh hasilnya."}
            </p>

            {!savedStrip ? (
              <div className="mt-6 space-y-4">
                <div>
                  <label htmlFor="caption" className="label">
                    Caption <span className="font-normal text-plum/45">(opsional)</span>
                  </label>
                  <input
                    id="caption"
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    maxLength={160}
                    className="input"
                    placeholder="Beri nama untuk momen ini…"
                  />
                </div>
                <label className="flex items-start gap-3 rounded-2xl border border-blush bg-cream/60 px-4 py-3 text-sm text-plum/75">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(event) => setIsPublic(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#5a1f31]"
                  />
                  Tampilkan di gallery publik SnapBooth
                </label>
                <button type="button" onClick={() => void saveStrip()} disabled={saving} className="btn btn-primary w-full py-3.5">
                  {saving ? "Menyimpan…" : "Simpan ke Gallery"}
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Tersimpan sebagai photo strip #{savedStrip.id}
                  {savedStrip.isPublic ? " · tampil di gallery" : " · privat"}
                </div>
                <a href={`/api/photo-strips/${savedStrip.id}/download`} className="btn btn-primary w-full py-3.5">
                  <DownloadIcon className="h-5 w-5" />
                  Unduh Photo Strip
                </a>
                <Link href="/gallery" className="btn btn-secondary w-full">
                  <GridIcon className="h-4 w-4" />
                  Lihat Gallery
                </Link>
              </div>
            )}

            <button type="button" onClick={resetAll} className="btn btn-ghost mt-4 w-full">
              <RefreshIcon className="h-4 w-4" />
              Foto lagi
            </button>
            <p className="mt-4 text-center text-[11px] leading-relaxed text-plum/45">
              Setiap unduhan akan tercatat di riwayat jika kamu masuk ke akun.
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
