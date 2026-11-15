import { handleRoute, HttpError, jsonResponse, readJson, validate } from "@/lib/api";
import { hashPassword, setAuthCookie } from "@/lib/auth";
import { db, type ResultSetHeader, type RowDataPacket } from "@/lib/db";
import { registerSchema } from "@/lib/validators";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const input = validate(registerSchema, await readJson(request));

    const [existing] = await db.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [input.email],
    );
    if (existing.length > 0) {
      throw new HttpError(409, "Email sudah terdaftar. Silakan masuk.");
    }

    const [result] = await db.query<ResultSetHeader>(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'USER')",
      [input.name, input.email, hashPassword(input.password)],
    );

    const user = {
      id: result.insertId,
      name: input.name,
      email: input.email,
      role: "USER" as const,
    };
    await setAuthCookie(user);
    return jsonResponse({ data: user }, 201);
  });
}
