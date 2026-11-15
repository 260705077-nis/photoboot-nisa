import { assertFound, boolToDb, handleRoute, jsonResponse, like, listParams, readJson, validate } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db, type ResultSetHeader, type RowDataPacket } from "@/lib/db";
import { mapFilter } from "@/lib/mappers";
import { filterCreateSchema } from "@/lib/validators";

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
      `SELECT COUNT(*) AS total FROM filters ${whereSql}`,
      values,
    );
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT * FROM filters ${whereSql} ORDER BY ${params.sort} ${params.order}, id ASC LIMIT ? OFFSET ?`,
      [...values, params.limit, params.offset],
    );

    const total = Number(countRow.total);
    return jsonResponse({
      data: rows.map(mapFilter),
      meta: { page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) },
    });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    await requireAdmin();
    const input = validate(filterCreateSchema, await readJson(request));

    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO filters (name, slug, description, css_filter, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.name,
        input.slug,
        input.description ?? null,
        input.cssFilter,
        boolToDb(input.isActive),
        input.sortOrder,
      ],
    );

    const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM filters WHERE id = ? LIMIT 1", [
      result.insertId,
    ]);
    return jsonResponse({ data: mapFilter(assertFound(rows[0], "Filter gagal dibuat.")) }, 201);
  });
}
