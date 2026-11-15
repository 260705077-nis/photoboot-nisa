import { assertFound, boolToDb, handleRoute, jsonResponse, like, listParams, readJson, validate } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db, type ResultSetHeader, type RowDataPacket } from "@/lib/db";
import { mapFrame } from "@/lib/mappers";
import { frameCreateSchema } from "@/lib/validators";

const SORTS = ["name", "sort_order", "created_at", "updated_at"];

export async function GET(request: Request) {
  return handleRoute(async () => {
    const params = listParams(request, SORTS, "sort_order", "asc");
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get("active") === "1";
    const where: string[] = [];
    const values: unknown[] = [];

    if (activeOnly) where.push("is_active = 1");
    if (params.search) {
      where.push("(name LIKE ? OR description LIKE ? OR slug LIKE ?)");
      const term = like(params.search);
      values.push(term, term, term);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const [[countRow]] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM frames ${whereSql}`,
      values,
    );
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT * FROM frames ${whereSql} ORDER BY ${params.sort} ${params.order}, id ASC LIMIT ? OFFSET ?`,
      [...values, params.limit, params.offset],
    );

    const total = Number(countRow.total);
    return jsonResponse({
      data: rows.map(mapFrame),
      meta: { page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) },
    });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    await requireAdmin();
    const input = validate(frameCreateSchema, await readJson(request));

    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO frames (name, slug, description, image_url, slot_count, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.name,
        input.slug,
        input.description ?? null,
        input.imageUrl,
        input.slotCount,
        boolToDb(input.isActive),
        input.sortOrder,
      ],
    );

    const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM frames WHERE id = ? LIMIT 1", [
      result.insertId,
    ]);
    return jsonResponse({ data: mapFrame(assertFound(rows[0], "Frame gagal dibuat.")) }, 201);
  });
}
