import {
  assertFound,
  boolToDb,
  handleRoute,
  HttpError,
  jsonResponse,
  readJson,
  validate,
} from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db, type RowDataPacket } from "@/lib/db";
import { mapFilter } from "@/lib/mappers";
import { filterUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "ID tidak valid.");
  return id;
}

export async function GET(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM filters WHERE id = ? LIMIT 1", [
      parseId(id),
    ]);
    return jsonResponse({ data: mapFilter(assertFound(rows[0])) });
  });
}

export async function PUT(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const filterId = parseId(id);
    const input = validate(filterUpdateSchema, await readJson(request));

    const [existing] = await db.query<RowDataPacket[]>("SELECT id FROM filters WHERE id = ? LIMIT 1", [
      filterId,
    ]);
    assertFound(existing[0]);

    const fields: string[] = [];
    const values: unknown[] = [];
    if (input.name !== undefined) {
      fields.push("name = ?");
      values.push(input.name);
    }
    if (input.slug !== undefined) {
      fields.push("slug = ?");
      values.push(input.slug);
    }
    if (input.description !== undefined) {
      fields.push("description = ?");
      values.push(input.description);
    }
    if (input.cssFilter !== undefined) {
      fields.push("css_filter = ?");
      values.push(input.cssFilter);
    }
    if (input.isActive !== undefined) {
      fields.push("is_active = ?");
      values.push(boolToDb(input.isActive));
    }
    if (input.sortOrder !== undefined) {
      fields.push("sort_order = ?");
      values.push(input.sortOrder);
    }

    if (fields.length === 0) throw new HttpError(400, "Tidak ada perubahan yang dikirim.");
    values.push(filterId);
    await db.query(`UPDATE filters SET ${fields.join(", ")} WHERE id = ?`, values);

    const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM filters WHERE id = ? LIMIT 1", [
      filterId,
    ]);
    return jsonResponse({ data: mapFilter(assertFound(rows[0])) });
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const filterId = parseId(id);
    const [existing] = await db.query<RowDataPacket[]>("SELECT id FROM filters WHERE id = ? LIMIT 1", [
      filterId,
    ]);
    assertFound(existing[0]);
    await db.query("DELETE FROM filters WHERE id = ?", [filterId]);
    return jsonResponse({ ok: true });
  });
}
