import { assertFound, handleRoute, HttpError, jsonResponse, readJson, validate } from "@/lib/api";
import { requireAdmin, requireUser } from "@/lib/auth";
import { db, type RowDataPacket } from "@/lib/db";
import { mapDownload } from "@/lib/mappers";
import { downloadUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

const SELECT = `SELECT d.*, ps.image_url, ps.caption, u.name AS user_name
  FROM downloads d
  JOIN photo_strips ps ON ps.id = d.photo_strip_id
  LEFT JOIN users u ON u.id = d.user_id`;

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "ID tidak valid.");
  return id;
}

export async function GET(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const [rows] = await db.query<RowDataPacket[]>(`${SELECT} WHERE d.id = ? LIMIT 1`, [
      parseId(id),
    ]);
    const download = assertFound(rows[0]);
    if (user.role !== "ADMIN" && Number(download.user_id) !== user.id) {
      throw new HttpError(403, "Tidak dapat melihat unduhan ini.");
    }
    return jsonResponse({ data: mapDownload(download) });
  });
}

export async function PUT(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const downloadId = parseId(id);
    const input = validate(downloadUpdateSchema, await readJson(request));

    const [existing] = await db.query<RowDataPacket[]>(
      "SELECT id FROM downloads WHERE id = ? LIMIT 1",
      [downloadId],
    );
    assertFound(existing[0]);

    const fields: string[] = [];
    const values: unknown[] = [];
    if (input.photoStripId !== undefined) {
      fields.push("photo_strip_id = ?");
      values.push(input.photoStripId);
    }
    if (input.userId !== undefined) {
      fields.push("user_id = ?");
      values.push(input.userId);
    }
    if (fields.length === 0) throw new HttpError(400, "Tidak ada perubahan yang dikirim.");
    values.push(downloadId);
    await db.query(`UPDATE downloads SET ${fields.join(", ")} WHERE id = ?`, values);

    const [rows] = await db.query<RowDataPacket[]>(`${SELECT} WHERE d.id = ? LIMIT 1`, [downloadId]);
    return jsonResponse({ data: mapDownload(assertFound(rows[0])) });
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const downloadId = parseId(id);
    const [existing] = await db.query<RowDataPacket[]>(
      "SELECT id FROM downloads WHERE id = ? LIMIT 1",
      [downloadId],
    );
    assertFound(existing[0]);
    await db.query("DELETE FROM downloads WHERE id = ?", [downloadId]);
    return jsonResponse({ ok: true });
  });
}
