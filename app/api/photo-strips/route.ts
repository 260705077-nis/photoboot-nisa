import {
  assertFound,
  boolToDb,
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
import { mapStrip } from "@/lib/mappers";
import { saveImageDataUrl } from "@/lib/uploads";
import { stripCreateSchema } from "@/lib/validators";
import type { AuthUser } from "@/lib/types";

const SORTS: Record<string, string> = {
  created_at: "ps.created_at",
  caption: "ps.caption",
};

const SELECT = `SELECT ps.*, s.session_code, u.name AS user_name, f.name AS frame_name, fl.name AS filter_name
  FROM photo_strips ps
  JOIN photo_sessions s ON s.id = ps.session_id
  LEFT JOIN users u ON u.id = s.user_id
  LEFT JOIN frames f ON f.id = ps.frame_id
  LEFT JOIN filters fl ON fl.id = ps.filter_id`;

export async function GET(request: Request) {
  return handleRoute(async () => {
    const url = new URL(request.url);
    const publicOnly = url.searchParams.get("public") === "1";
    if (!publicOnly) await requireAdmin();

    const params = listParams(request, Object.keys(SORTS), "created_at", "desc");
    const sort = SORTS[params.sort] ?? "ps.created_at";
    const where: string[] = [];
    const values: unknown[] = [];

    if (publicOnly) where.push("ps.is_public = 1");
    if (params.search) {
      where.push("(ps.caption LIKE ? OR s.session_code LIKE ? OR u.name LIKE ?)");
      const term = like(params.search);
      values.push(term, term, term);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const [[countRow]] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM photo_strips ps
       JOIN photo_sessions s ON s.id = ps.session_id
       LEFT JOIN users u ON u.id = s.user_id ${whereSql}`,
      values,
    );
    const [rows] = await db.query<RowDataPacket[]>(
      `${SELECT} ${whereSql} ORDER BY ${sort} ${params.order}, ps.id DESC LIMIT ? OFFSET ?`,
      [...values, params.limit, params.offset],
    );

    const total = Number(countRow.total);
    return jsonResponse({
      data: rows.map(mapStrip),
      meta: { page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) },
    });
  });
}

type SessionRow = RowDataPacket & {
  id: number;
  session_code: string;
  user_id: number | null;
  frame_id: number | null;
  filter_id: number | null;
  status: string;
};

async function resolveOwnedSession(
  currentUser: AuthUser | null,
  input: { sessionCode?: string; sessionId?: number | null },
): Promise<SessionRow> {
  if (input.sessionCode) {
    const [rows] = await db.query<SessionRow[]>(
      "SELECT id, session_code, user_id, frame_id, filter_id, status FROM photo_sessions WHERE session_code = ? LIMIT 1",
      [input.sessionCode],
    );
    return assertFound(rows[0], "Sesi foto tidak ditemukan.");
  }

  if (input.sessionId) {
    const [rows] = await db.query<SessionRow[]>(
      "SELECT id, session_code, user_id, frame_id, filter_id, status FROM photo_sessions WHERE id = ? LIMIT 1",
      [input.sessionId],
    );
    const session = assertFound(rows[0], "Sesi foto tidak ditemukan.");
    const allowed =
      currentUser?.role === "ADMIN" ||
      (currentUser !== null && session.user_id !== null && Number(session.user_id) === currentUser.id);
    if (!allowed) throw new HttpError(403, "Tidak dapat mengakses sesi ini.");
    return session;
  }

  throw new HttpError(400, "sessionCode atau sessionId wajib diisi.");
}

async function fetchStrip(id: number) {
  const [rows] = await db.query<RowDataPacket[]>(`${SELECT} WHERE ps.id = ? LIMIT 1`, [id]);
  return assertFound(rows[0]);
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const currentUser = await getCurrentUser();
    const input = validate(stripCreateSchema, await readJson(request));
    const session = await resolveOwnedSession(currentUser, input);

    if (session.status === "CANCELLED") throw new HttpError(409, "Sesi foto sudah dibatalkan.");
    if (session.status !== "ACTIVE" && currentUser?.role !== "ADMIN") {
      throw new HttpError(409, "Sesi foto sudah selesai.");
    }

    const [existing] = await db.query<RowDataPacket[]>(
      "SELECT id FROM photo_strips WHERE session_id = ? LIMIT 1",
      [session.id],
    );
    if (existing.length > 0) throw new HttpError(409, "Photo strip untuk sesi ini sudah ada.");

    const imageUrl = input.dataUrl ? await saveImageDataUrl(input.dataUrl, "strips") : input.imageUrl;
    if (!imageUrl) throw new HttpError(400, "Gambar strip wajib diisi.");

    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO photo_strips (session_id, frame_id, filter_id, image_url, caption, is_public)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [session.id, session.frame_id, session.filter_id, imageUrl, input.caption ?? null, boolToDb(input.isPublic)],
    );
    await db.query(
      "UPDATE photo_sessions SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
      [session.id],
    );

    const strip = await fetchStrip(result.insertId);
    return jsonResponse({ data: mapStrip(strip) }, 201);
  });
}
