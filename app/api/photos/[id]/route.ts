import {
  assertFound,
  handleRoute,
  HttpError,
  jsonResponse,
  readJson,
  validate,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { db, type RowDataPacket } from "@/lib/db";
import { mapPhoto } from "@/lib/mappers";
import { removeUploadedAssets, saveImageDataUrl } from "@/lib/uploads";
import { photoUpdateSchema } from "@/lib/validators";
import type { AuthUser } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "ID tidak valid.");
  return id;
}

async function getPhotoWithSession(id: number) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT p.*, s.session_code, s.user_id, s.status FROM photos p
     JOIN photo_sessions s ON s.id = p.session_id WHERE p.id = ? LIMIT 1`,
    [id],
  );
  return assertFound(rows[0]);
}

function canAccess(photo: RowDataPacket, user: AuthUser | null, code: string | null): boolean {
  return (
    user?.role === "ADMIN" ||
    (user !== null && photo.user_id !== null && Number(photo.user_id) === user.id) ||
    (code !== null && code === photo.session_code)
  );
}

export async function GET(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const photo = await getPhotoWithSession(parseId(id));
    const user = await getCurrentUser();
    const code = new URL(request.url).searchParams.get("code");
    if (!canAccess(photo, user, code)) throw new HttpError(403, "Foto ini bersifat privat.");
    return jsonResponse({ data: mapPhoto(photo) });
  });
}

export async function PUT(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const photoId = parseId(id);
    const photo = await getPhotoWithSession(photoId);
    const user = await getCurrentUser();
    const code = new URL(request.url).searchParams.get("code");
    if (!canAccess(photo, user, code)) throw new HttpError(403, "Tidak dapat mengubah foto ini.");

    const input = validate(photoUpdateSchema, await readJson(request));
    if (photo.status !== "ACTIVE" && user?.role !== "ADMIN") {
      throw new HttpError(409, "Sesi foto sudah selesai.");
    }

    let imageUrl: string | undefined;
    if (input.dataUrl) imageUrl = await saveImageDataUrl(input.dataUrl, "photos");
    else if (input.imageUrl) imageUrl = input.imageUrl;

    const fields: string[] = [];
    const values: unknown[] = [];
    if (input.position !== undefined) {
      fields.push("position = ?");
      values.push(input.position);
    }
    if (imageUrl !== undefined) {
      fields.push("image_url = ?");
      values.push(imageUrl);
    }
    if (fields.length === 0) throw new HttpError(400, "Tidak ada perubahan yang dikirim.");
    values.push(photoId);
    await db.query(`UPDATE photos SET ${fields.join(", ")} WHERE id = ?`, values);
    if (imageUrl !== undefined && imageUrl !== photo.image_url) {
      await removeUploadedAssets([String(photo.image_url)]);
    }

    const updated = await getPhotoWithSession(photoId);
    return jsonResponse({ data: mapPhoto(updated) });
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const photoId = parseId(id);
    const photo = await getPhotoWithSession(photoId);
    const user = await getCurrentUser();
    const code = new URL(request.url).searchParams.get("code");
    if (!canAccess(photo, user, code)) throw new HttpError(403, "Tidak dapat menghapus foto ini.");
    await db.query("DELETE FROM photos WHERE id = ?", [photoId]);
    await removeUploadedAssets([String(photo.image_url)]);
    return jsonResponse({ ok: true });
  });
}
