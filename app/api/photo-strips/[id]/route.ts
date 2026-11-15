import {
  assertFound,
  boolToDb,
  handleRoute,
  HttpError,
  jsonResponse,
  readJson,
  validate,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { db, type RowDataPacket } from "@/lib/db";
import { mapStrip } from "@/lib/mappers";
import { removeUploadedAssets } from "@/lib/uploads";
import { stripUpdateSchema } from "@/lib/validators";
import type { AuthUser } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

const SELECT = `SELECT ps.*, s.session_code, s.user_id AS owner_user_id, u.name AS user_name,
  f.name AS frame_name, fl.name AS filter_name
  FROM photo_strips ps
  JOIN photo_sessions s ON s.id = ps.session_id
  LEFT JOIN users u ON u.id = s.user_id
  LEFT JOIN frames f ON f.id = ps.frame_id
  LEFT JOIN filters fl ON fl.id = ps.filter_id`;

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "ID tidak valid.");
  return id;
}

async function getStrip(id: number) {
  const [rows] = await db.query<RowDataPacket[]>(`${SELECT} WHERE ps.id = ? LIMIT 1`, [id]);
  return assertFound(rows[0]);
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
    const strip = await getStrip(parseId(id));
    const user = await getCurrentUser();
    const code = new URL(request.url).searchParams.get("code");
    if (!strip.is_public && !canAccess(strip, user, code)) {
      throw new HttpError(403, "Photo strip ini bersifat privat.");
    }
    return jsonResponse({ data: mapStrip(strip) });
  });
}

export async function PUT(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const stripId = parseId(id);
    const strip = await getStrip(stripId);
    const user = await getCurrentUser();
    const code = new URL(request.url).searchParams.get("code");
    if (!canAccess(strip, user, code)) throw new HttpError(403, "Tidak dapat mengubah photo strip ini.");

    const input = validate(stripUpdateSchema, await readJson(request));
    const fields: string[] = [];
    const values: unknown[] = [];
    if (input.imageUrl !== undefined) {
      fields.push("image_url = ?");
      values.push(input.imageUrl);
    }
    if (input.caption !== undefined) {
      fields.push("caption = ?");
      values.push(input.caption);
    }
    if (input.isPublic !== undefined) {
      fields.push("is_public = ?");
      values.push(boolToDb(input.isPublic));
    }
    if (fields.length === 0) throw new HttpError(400, "Tidak ada perubahan yang dikirim.");
    values.push(stripId);
    await db.query(`UPDATE photo_strips SET ${fields.join(", ")} WHERE id = ?`, values);
    if (input.imageUrl !== undefined && input.imageUrl !== strip.image_url) {
      await removeUploadedAssets([String(strip.image_url)]);
    }

    const updated = await getStrip(stripId);
    return jsonResponse({ data: mapStrip(updated) });
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const stripId = parseId(id);
    const strip = await getStrip(stripId);
    const user = await getCurrentUser();
    const code = new URL(request.url).searchParams.get("code");
    if (!canAccess(strip, user, code)) throw new HttpError(403, "Tidak dapat menghapus photo strip ini.");

    await db.query("DELETE FROM photo_strips WHERE id = ?", [stripId]);
    await removeUploadedAssets([String(strip.image_url)]);
    return jsonResponse({ ok: true });
  });
}
