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
import { mapFrame } from "@/lib/mappers";
import { frameUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "ID tidak valid.");
  return id;
}

export async function GET(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM frames WHERE id = ? LIMIT 1", [
      parseId(id),
    ]);
    return jsonResponse({ data: mapFrame(assertFound(rows[0])) });
  });
}

export async function PUT(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const frameId = parseId(id);
    const input = validate(frameUpdateSchema, await readJson(request));

    const [existing] = await db.query<RowDataPacket[]>("SELECT id FROM frames WHERE id = ? LIMIT 1", [
      frameId,
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
    if (input.imageUrl !== undefined) {
      fields.push("image_url = ?");
      values.push(input.imageUrl);
    }
    if (input.slotCount !== undefined) {
      fields.push("slot_count = ?");
      values.push(input.slotCount);
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
    values.push(frameId);
    await db.query(`UPDATE frames SET ${fields.join(", ")} WHERE id = ?`, values);

    const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM frames WHERE id = ? LIMIT 1", [
      frameId,
    ]);
    return jsonResponse({ data: mapFrame(assertFound(rows[0])) });
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const frameId = parseId(id);
    const [existing] = await db.query<RowDataPacket[]>("SELECT id FROM frames WHERE id = ? LIMIT 1", [
      frameId,
    ]);
    assertFound(existing[0]);
    await db.query("DELETE FROM frames WHERE id = ?", [frameId]);
    return jsonResponse({ ok: true });
  });
}
