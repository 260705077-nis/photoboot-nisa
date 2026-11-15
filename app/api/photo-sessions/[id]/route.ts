import {
  assertFound,
  handleRoute,
  HttpError,
  jsonResponse,
  readJson,
  validate,
} from "@/lib/api";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { db, type RowDataPacket } from "@/lib/db";
import { mapSession } from "@/lib/mappers";
import { removeUploadedAssets } from "@/lib/uploads";
import { sessionUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

const SELECT = `SELECT s.*, u.name AS user_name, f.name AS frame_name, fl.name AS filter_name
  FROM photo_sessions s
  LEFT JOIN users u ON u.id = s.user_id
  LEFT JOIN frames f ON f.id = s.frame_id
  LEFT JOIN filters fl ON fl.id = s.filter_id`;

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "ID tidak valid.");
  return id;
}

export async function GET(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const sessionId = parseId(id);
    const [rows] = await db.query<RowDataPacket[]>(`${SELECT} WHERE s.id = ? LIMIT 1`, [sessionId]);
    const session = assertFound(rows[0]);

    const currentUser = await getCurrentUser();
    const code = new URL(request.url).searchParams.get("code");
    const allowed =
      currentUser?.role === "ADMIN" ||
      (currentUser && Number(session.user_id) === currentUser.id) ||
      (code !== null && code === session.session_code);

    if (!allowed) throw new HttpError(403, "Sesi ini bersifat privat.");
    return jsonResponse({ data: mapSession(session) });
  });
}

export async function PUT(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const sessionId = parseId(id);
    const input = validate(sessionUpdateSchema, await readJson(request));

    const [existingRows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM photo_sessions WHERE id = ? LIMIT 1",
      [sessionId],
    );
    const existing = assertFound(existingRows[0]);

    const nextFrameId = input.frameId !== undefined ? input.frameId : existing.frame_id;
    const nextPhotoCount = input.photoCount ?? Number(existing.photo_count);

    if (nextFrameId) {
      const [frames] = await db.query<RowDataPacket[]>(
        "SELECT id, slot_count FROM frames WHERE id = ? LIMIT 1",
        [nextFrameId],
      );
      const frame = assertFound(frames[0], "Frame tidak ditemukan.");
      if (Number(frame.slot_count) !== nextPhotoCount) {
        throw new HttpError(400, "Jumlah foto tidak cocok dengan slot frame yang dipilih.");
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    if (input.userId !== undefined) {
      fields.push("user_id = ?");
      values.push(input.userId);
    }
    if (input.frameId !== undefined) {
      fields.push("frame_id = ?");
      values.push(input.frameId);
    }
    if (input.filterId !== undefined) {
      fields.push("filter_id = ?");
      values.push(input.filterId);
    }
    if (input.photoCount !== undefined) {
      fields.push("photo_count = ?");
      values.push(input.photoCount);
    }
    if (input.status !== undefined) {
      fields.push("status = ?");
      values.push(input.status);
      fields.push("completed_at = ?");
      values.push(input.status === "COMPLETED" ? new Date() : null);
    }

    if (fields.length === 0) throw new HttpError(400, "Tidak ada perubahan yang dikirim.");
    values.push(sessionId);
    await db.query(`UPDATE photo_sessions SET ${fields.join(", ")} WHERE id = ?`, values);

    const [rows] = await db.query<RowDataPacket[]>(`${SELECT} WHERE s.id = ? LIMIT 1`, [sessionId]);
    return jsonResponse({ data: mapSession(assertFound(rows[0])) });
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const sessionId = parseId(id);
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT id FROM photo_sessions WHERE id = ? LIMIT 1",
      [sessionId],
    );
    assertFound(rows[0]);
    const [assets] = await db.query<RowDataPacket[]>(
      `SELECT image_url FROM photos WHERE session_id = ?
       UNION ALL
       SELECT image_url FROM photo_strips WHERE session_id = ?`,
      [sessionId, sessionId],
    );
    await db.query("DELETE FROM photo_sessions WHERE id = ?", [sessionId]);
    await removeUploadedAssets(assets.map((row) => String(row.image_url)));
    return jsonResponse({ ok: true });
  });
}
