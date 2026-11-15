import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { HttpError } from "@/lib/api";

const MAX_BYTES = 8 * 1024 * 1024;
const PUBLIC_ROOT = path.resolve(process.cwd(), "public");
const UPLOAD_ROOT = path.resolve(process.cwd(), "storage", "uploads");
const EXTENSIONS: Record<string, string> = {
  png: "png",
  jpeg: "jpg",
  jpg: "jpg",
  webp: "webp",
};
const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function saveImageDataUrl(dataUrl: string, folder: "photos" | "strips"): Promise<string> {
  const match = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new HttpError(400, "Format gambar tidak didukung.");

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0) throw new HttpError(400, "Gambar kosong.");
  if (buffer.length > MAX_BYTES) throw new HttpError(413, "Ukuran gambar maksimal 8 MB.");

  const ext = EXTENSIONS[match[1].toLowerCase()] ?? "png";
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const directory = path.join(UPLOAD_ROOT, folder);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, fileName), buffer);
  return `/uploads/${folder}/${fileName}`;
}

function resolveWithin(root: string, relative: string): string | null {
  const filePath = path.resolve(root, relative);
  if (!filePath.startsWith(root + path.sep)) return null;
  return filePath;
}

export function resolvePublicAsset(url: string): { filePath: string; contentType: string } | null {
  const clean = url.split("?")[0];

  let filePath: string | null = null;
  if (clean.startsWith("/uploads/")) {
    filePath = resolveWithin(UPLOAD_ROOT, clean.slice("/uploads/".length));
  } else if (clean.startsWith("/seed/")) {
    filePath = resolveWithin(PUBLIC_ROOT, clean.slice(1));
  }
  if (!filePath) return null;

  const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()];
  if (!contentType) return null;

  return { filePath, contentType };
}

export async function removeUploadedAssets(urls: Array<string | null | undefined>): Promise<void> {
  await Promise.all(
    urls.map(async (url) => {
      if (!url?.startsWith("/uploads/")) return;
      const filePath = resolveWithin(UPLOAD_ROOT, url.split("?")[0].slice("/uploads/".length));
      if (!filePath) return;
      try {
        await fs.unlink(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          console.error(`Gagal menghapus file upload ${filePath}:`, error);
        }
      }
    }),
  );
}
