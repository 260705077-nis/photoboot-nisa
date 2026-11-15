import { z } from "zod";

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse({ error: error.message, details: error.details }, error.status);
  }

  const dbError = error as { code?: string; errno?: number };
  if (dbError?.code === "ER_DUP_ENTRY") {
    return jsonResponse({ error: "Data duplikat. Gunakan nilai yang unik." }, 409);
  }
  if (dbError?.code === "ER_NO_REFERENCED_ROW_2") {
    return jsonResponse({ error: "Referensi data tidak ditemukan." }, 400);
  }
  if (dbError?.code === "ER_ROW_IS_REFERENCED_2") {
    return jsonResponse({ error: "Data masih dipakai oleh data lain." }, 409);
  }
  if (dbError?.code === "ER_CHECK_CONSTRAINT_VIOLATED" || dbError?.code === "WARN_DATA_OUT_OF_RANGE") {
    return jsonResponse({ error: "Nilai berada di luar batas yang diizinkan." }, 400);
  }

  console.error("API error:", error instanceof Error ? error.message : "unknown error");
  return jsonResponse({ error: "Terjadi kesalahan pada server." }, 500);
}

export async function handleRoute(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    return errorResponse(error);
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Body request harus berupa JSON yang valid.");
  }
}

export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  throw new HttpError(400, "Periksa kembali input Anda.", { fieldErrors });
}

export function getId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, "ID tidak valid.");
  }
  return id;
}

export function parseInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function listParams(
  request: Request,
  allowedSort: string[],
  defaultSort: string,
  defaultOrder: "asc" | "desc" = "desc",
) {
  const url = new URL(request.url);
  const page = parseInteger(url.searchParams.get("page"), 1, 1, 10000);
  const limit = parseInteger(url.searchParams.get("limit"), 10, 1, 100);
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 120);
  const requestedSort = url.searchParams.get("sort") ?? defaultSort;
  const sort = allowedSort.includes(requestedSort) ? requestedSort : defaultSort;
  const requestedOrder = url.searchParams.get("order");
  const order = requestedOrder === "asc" || requestedOrder === "desc" ? requestedOrder : defaultOrder;
  return { page, limit, search, sort, order, offset: (page - 1) * limit };
}

export function like(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

export function boolToDb(value: boolean): number {
  return value ? 1 : 0;
}

export function dbToBool(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

export function assertFound<T>(value: T | null | undefined, message = "Data tidak ditemukan."): T {
  if (value === null || value === undefined) throw new HttpError(404, message);
  return value;
}
