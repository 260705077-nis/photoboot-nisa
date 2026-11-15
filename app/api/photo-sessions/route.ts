import crypto from "node:crypto";
import {
  assertFound,
  handleRoute,
  HttpError,
  jsonResponse,
  like,
  listParams,
  readJson,
  validate,
} from "@/lib/api";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { db, type ResultSetHeader, type RowDataPacket } from "@/lib/db";
import { mapSession } from "@/lib/mappers";
import { sessionCreateSchema } from "@/lib/validators";

const SORTS: Record<string, string> = {
  created_at: "s.created_at",
  status: "s.status",
  session_code: "s.session_code",
};

const SELECT = `SELECT s.*, u.name AS user_name, f.name AS frame_name, fl.name AS filter_name
  FROM photo_sessions s
  LEFT JOIN users u ON u.id = s.user_id
  LEFT JOIN frames f ON f.id = s.frame_id
  LEFT JOIN filters fl ON fl.id = s.filter_id`;

export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireAdmin();
    const params = listParams(request, Object.keys(SORTS), "created_at", "desc");
    const sort = SORTS[params.sort] ?? "s.created_at";
    const where: string[] = [];
    const values: unknown[] = [];

    if (params.search) {
      where.push("(s.session_code LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR f.name LIKE ? OR fl.name LIKE ?)");
      const term = like(params.search);
      values.push(term, term, term, term, term);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const [[countRow]] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM photo_sessions s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN frames f ON f.id = s.frame_id
       LEFT JOIN filters fl ON fl.id = s.filter_id
       ${whereSql}`,
      values,
    );
    const [rows] = await db.query<RowDataPacket[]>(
      `${SELECT} ${whereSql} ORDER BY ${sort} ${params.order}, s.id DESC LIMIT ? OFFSET ?`,
      [...values, params.limit, params.offset],
    );

    const total = Number(countRow.total);
    return jsonResponse({
      data: rows.map(mapSession),
      meta: { page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) },
    });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const currentUser = await getCurrentUser();
    const input = validate(sessionCreateSchema, await readJson(request));

    let userId: number | null = null;
    if (currentUser?.role === "ADMIN" && input.userId !== undefined) {
      userId = input.userId ?? null;
    } else if (currentUser) {
      userId = currentUser.id;
    }

    if (input.frameId) {
      const [frames] = await db.query<RowDataPacket[]>(
        "SELECT id, slot_count FROM frames WHERE id = ? LIMIT 1",
        [input.frameId],
      );
      const frame = assertFound(frames[0], "Frame tidak ditemukan.");
      if (Number(frame.slot_count) !== input.photoCount) {
        throw new HttpError(400, "Jumlah foto tidak cocok dengan slot frame yang dipilih.");
      }
    }

    const sessionCode = crypto.randomUUID();
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO photo_sessions (session_code, user_id, frame_id, filter_id, photo_count, status)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
      [sessionCode, userId, input.frameId ?? null, input.filterId ?? null, input.photoCount],
    );

    const [rows] = await db.query<RowDataPacket[]>(`${SELECT} WHERE s.id = ? LIMIT 1`, [
      result.insertId,
    ]);
    return jsonResponse({ data: mapSession(assertFound(rows[0])) }, 201);
  });
}
