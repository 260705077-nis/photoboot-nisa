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
import { mapPhoto } from "@/lib/mappers";
import { saveImageDataUrl } from "@/lib/uploads";
import { photoCreateSchema } from "@/lib/validators";
import type { AuthUser } from "@/lib/types";

const SORTS: Record<string, string> = {
  created_at: "p.created_at",
  position: "p.position",
};

export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireAdmin();
    const params = listParams(request, Object.keys(SORTS), "created_at", "desc");
    const sort = SORTS[params.sort] ?? "p.created_at";
    const where: string[] = [];
    const values: unknown[] = [];

    if (params.search) {
      where.push("(s.session_code LIKE ? OR p.image_url LIKE ?)");
      const term = like(params.search);
      values.push(term, term);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const [[countRow]] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM photos p
       LEFT JOIN photo_sessions s ON s.id = p.session_id ${whereSql}`,
      values,
    );
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT p.*, s.session_code FROM photos p
       LEFT JOIN photo_sessions s ON s.id = p.session_id
       ${whereSql} ORDER BY ${sort} ${params.order}, p.id DESC LIMIT ? OFFSET ?`,
      [...values, params.limit, params.offset],
    );

    const total = Number(countRow.total);
    return jsonResponse({
      data: rows.map(mapPhoto),
      meta: { page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) },
    });
  });
}

type SessionRow = RowDataPacket & {
  id: number;
  session_code: string;
  user_id: number | null;
  status: string;
};

async function resolveSession(
  currentUser: AuthUser | null,
  input: { sessionCode?: string; sessionId?: number | null },
): Promise<SessionRow> {
  if (input.sessionCode) {
    const [rows] = await db.query<SessionRow[]>(
      "SELECT id, session_code, user_id, status FROM photo_sessions WHERE session_code = ? LIMIT 1",
      [input.sessionCode],
    );
    return assertFound(rows[0], "Sesi foto tidak ditemukan.");
  }

  if (input.sessionId) {
    const [rows] = await db.query<SessionRow[]>(
      "SELECT id, session_code, user_id, status FROM photo_sessions WHERE id = ? LIMIT 1",
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

async function fetchPhoto(id: number) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT p.*, s.session_code FROM photos p
     LEFT JOIN photo_sessions s ON s.id = p.session_id WHERE p.id = ? LIMIT 1`,
    [id],
  );
  return assertFound(rows[0]);
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const currentUser = await getCurrentUser();
    const input = validate(photoCreateSchema, await readJson(request));
    const session = await resolveSession(currentUser, input);

    if (session.status === "CANCELLED") throw new HttpError(409, "Sesi foto sudah dibatalkan.");
    if (session.status !== "ACTIVE" && currentUser?.role !== "ADMIN") {
      throw new HttpError(409, "Sesi foto sudah selesai.");
    }

    const imageUrl = input.dataUrl ? await saveImageDataUrl(input.dataUrl, "photos") : input.imageUrl;
    if (!imageUrl) throw new HttpError(400, "Gambar wajib diisi.");

    const [result] = await db.query<ResultSetHeader>(
      "INSERT INTO photos (session_id, position, image_url) VALUES (?, ?, ?)",
      [session.id, input.position, imageUrl],
    );
    const photo = await fetchPhoto(result.insertId);
    return jsonResponse({ data: mapPhoto(photo) }, 201);
  });
}
