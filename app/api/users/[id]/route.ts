import { assertFound, handleRoute, HttpError, jsonResponse, readJson, validate } from "@/lib/api";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { db, type RowDataPacket } from "@/lib/db";
import { mapUser } from "@/lib/mappers";
import { userUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "ID tidak valid.");
  return id;
}

export async function GET(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ? LIMIT 1",
      [parseId(id)],
    );
    return jsonResponse({ data: mapUser(assertFound(rows[0])) });
  });
}

export async function PUT(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const userId = parseId(id);
    const input = validate(userUpdateSchema, await readJson(request));

    const [existingRows] = await db.query<RowDataPacket[]>(
      "SELECT id, role FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    assertFound(existingRows[0]);

    if (userId === admin.id && input.role === "USER") {
      throw new HttpError(400, "Tidak dapat menurunkan peran akun sendiri.");
    }
    if (input.email) {
      const [duplicate] = await db.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1",
        [input.email, userId],
      );
      if (duplicate.length > 0) throw new HttpError(409, "Email sudah digunakan.");
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    if (input.name !== undefined) {
      fields.push("name = ?");
      values.push(input.name);
    }
    if (input.email !== undefined) {
      fields.push("email = ?");
      values.push(input.email);
    }
    if (input.role !== undefined) {
      fields.push("role = ?");
      values.push(input.role);
    }
    if (input.password !== undefined) {
      fields.push("password_hash = ?");
      values.push(hashPassword(input.password));
    }

    if (fields.length === 0) throw new HttpError(400, "Tidak ada perubahan yang dikirim.");
    values.push(userId);
    await db.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);

    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    return jsonResponse({ data: mapUser(assertFound(rows[0])) });
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const userId = parseId(id);
    if (userId === admin.id) throw new HttpError(400, "Tidak dapat menghapus akun sendiri.");

    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT id, role FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    const target = assertFound(rows[0]);
    if (target.role === "ADMIN") {
      const [[countRow]] = await db.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN'",
      );
      if (Number(countRow.total) <= 1) {
        throw new HttpError(400, "Minimal harus ada satu admin.");
      }
    }

    await db.query("DELETE FROM users WHERE id = ?", [userId]);
    return jsonResponse({ ok: true });
  });
}
