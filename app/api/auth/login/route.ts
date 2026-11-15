import { handleRoute, HttpError, jsonResponse, readJson, validate } from "@/lib/api";
import { setAuthCookie, verifyPassword } from "@/lib/auth";
import { db, type RowDataPacket } from "@/lib/db";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const input = validate(loginSchema, await readJson(request));

    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT id, name, email, password_hash, role FROM users WHERE email = ? LIMIT 1",
      [input.email],
    );
    if (rows.length === 0 || !verifyPassword(input.password, String(rows[0].password_hash))) {
      throw new HttpError(401, "Email atau password salah.");
    }

    const user = {
      id: Number(rows[0].id),
      name: String(rows[0].name),
      email: String(rows[0].email),
      role: rows[0].role === "ADMIN" ? ("ADMIN" as const) : ("USER" as const),
    };
    await setAuthCookie(user);
    return jsonResponse({ data: user });
  });
}
