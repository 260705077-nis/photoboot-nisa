import fs from "node:fs/promises";
import path from "node:path";
import { handleRoute, HttpError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { db, type RowDataPacket } from "@/lib/db";
import { resolvePublicAsset } from "@/lib/uploads";
import type { AuthUser } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "ID tidak valid.");
  return id;
}

function canAccess(strip: RowDataPacket, user: AuthUser | null, code: string | null): boolean {
  return (
    user?.role === "ADMIN" ||
    (user !== null && strip.owner_user_id !== null && Number(strip.owner_user_id) === user.id) ||
    (code !== null && code === strip.session_code)
  );
}

export async function GET(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const stripId = parseId(id);
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT ps.*, s.user_id AS owner_user_id, s.session_code
       FROM photo_strips ps JOIN photo_sessions s ON s.id = ps.session_id
       WHERE ps.id = ? LIMIT 1`,
      [stripId],
    );
    const strip = rows[0];
    if (!strip) throw new HttpError(404, "Photo strip tidak ditemukan.");

    const user = await getCurrentUser();
    const code = new URL(request.url).searchParams.get("code");
    if (!strip.is_public && !canAccess(strip, user, code)) {
      throw new HttpError(403, "Photo strip ini bersifat privat.");
    }

    await db.query("INSERT INTO downloads (photo_strip_id, user_id) VALUES (?, ?)", [
      stripId,
      user?.id ?? null,
    ]);

    const url = String(strip.image_url);
    const asset = resolvePublicAsset(url);
    if (!asset) {
      return Response.redirect(url, 302);
    }

    try {
      const file = await fs.readFile(asset.filePath);
      const extension = path.extname(asset.filePath).replace(".", "") || "png";
      return new Response(new Uint8Array(file), {
        headers: {
          "Content-Type": asset.contentType,
          "Content-Disposition": `attachment; filename="snapbooth-${stripId}.${extension}"`,
          "Cache-Control": "no-store",
        },
      });
    } catch {
      throw new HttpError(404, "File photo strip tidak ditemukan di server.");
    }
  });
}
