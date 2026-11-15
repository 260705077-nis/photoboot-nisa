import {
  assertFound,
  handleRoute,
  jsonResponse,
  like,
  listParams,
  readJson,
  validate,
} from "@/lib/api";
import { getCurrentUser, requireAdmin, requireUser } from "@/lib/auth";
import { db, type ResultSetHeader, type RowDataPacket } from "@/lib/db";
import { mapDownload } from "@/lib/mappers";
import { downloadCreateSchema } from "@/lib/validators";

const SORTS: Record<string, string> = {
  created_at: "d.created_at",
};

const SELECT = `SELECT d.*, ps.image_url, ps.caption, u.name AS user_name
  FROM downloads d
  JOIN photo_strips ps ON ps.id = d.photo_strip_id
  LEFT JOIN users u ON u.id = d.user_id`;

export async function GET(request: Request) {
  return handleRoute(async () => {
    const url = new URL(request.url);
    const mine = url.searchParams.get("mine") === "1";
    const user = mine ? await requireUser() : await requireAdmin();

    const params = listParams(request, Object.keys(SORTS), "created_at", "desc");
    const where: string[] = [];
    const values: unknown[] = [];
    if (mine) {
      where.push("d.user_id = ?");
      values.push(user.id);
    }
    if (params.search) {
      where.push("(ps.caption LIKE ? OR u.name LIKE ? OR u.email LIKE ?)");
      const term = like(params.search);
      values.push(term, term, term);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const [[countRow]] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM downloads d
       JOIN photo_strips ps ON ps.id = d.photo_strip_id
       LEFT JOIN users u ON u.id = d.user_id ${whereSql}`,
      values,
    );
    const [rows] = await db.query<RowDataPacket[]>(
      `${SELECT} ${whereSql} ORDER BY ${params.sort} ${params.order}, d.id DESC LIMIT ? OFFSET ?`,
      [...values, params.limit, params.offset],
    );

    const total = Number(countRow.total);
    return jsonResponse({
      data: rows.map(mapDownload),
      meta: { page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) },
    });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const currentUser = await getCurrentUser();
    const input = validate(downloadCreateSchema, await readJson(request));

    let userId: number | null = currentUser?.id ?? null;
    if (currentUser?.role === "ADMIN" && input.userId !== undefined) {
      userId = input.userId;
    }

    const [strips] = await db.query<RowDataPacket[]>(
      "SELECT id FROM photo_strips WHERE id = ? LIMIT 1",
      [input.photoStripId],
    );
    assertFound(strips[0], "Photo strip tidak ditemukan.");

    const [result] = await db.query<ResultSetHeader>(
      "INSERT INTO downloads (photo_strip_id, user_id) VALUES (?, ?)",
      [input.photoStripId, userId],
    );
    const [rows] = await db.query<RowDataPacket[]>(`${SELECT} WHERE d.id = ? LIMIT 1`, [
      result.insertId,
    ]);
    return jsonResponse({ data: mapDownload(assertFound(rows[0])) }, 201);
  });
}
