import { assertFound, handleRoute, HttpError, jsonResponse, like, listParams, readJson, validate } from "@/lib/api";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { db, type ResultSetHeader, type RowDataPacket } from "@/lib/db";
import { mapUser } from "@/lib/mappers";
import { userCreateSchema } from "@/lib/validators";

const SORTS = ["name", "email", "role", "created_at", "updated_at"];

export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireAdmin();
    const params = listParams(request, SORTS, "created_at", "desc");
    const where: string[] = [];
    const values: unknown[] = [];

    if (params.search) {
      where.push("(name LIKE ? OR email LIKE ?)");
      const term = like(params.search);
      values.push(term, term);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const [[countRow]] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM users ${whereSql}`,
      values,
    );
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT id, name, email, role, created_at, updated_at FROM users ${whereSql}
       ORDER BY ${params.sort} ${params.order}, id ASC LIMIT ? OFFSET ?`,
      [...values, params.limit, params.offset],
    );

    const total = Number(countRow.total);
    return jsonResponse({
      data: rows.map(mapUser),
      meta: { page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) },
    });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    await requireAdmin();
    const input = validate(userCreateSchema, await readJson(request));

    const [existing] = await db.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [input.email],
    );
    if (existing.length > 0) throw new HttpError(409, "Email sudah terdaftar.");

    const [result] = await db.query<ResultSetHeader>(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [input.name, input.email, hashPassword(input.password), input.role],
    );
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ? LIMIT 1",
      [result.insertId],
    );
    return jsonResponse({ data: mapUser(assertFound(rows[0])) }, 201);
  });
}
