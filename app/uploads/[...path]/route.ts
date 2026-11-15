import fs from "node:fs/promises";
import { resolvePublicAsset } from "@/lib/uploads";

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, context: RouteContext) {
  const { path: segments } = await context.params;
  const asset = resolvePublicAsset(`/uploads/${segments.join("/")}`);
  if (!asset) return new Response("Tidak ditemukan.", { status: 404 });

  try {
    const file = await fs.readFile(asset.filePath);
    return new Response(new Uint8Array(file), {
      headers: {
        "content-type": asset.contentType,
        "content-length": String(file.byteLength),
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Tidak ditemukan.", { status: 404 });
  }
}
