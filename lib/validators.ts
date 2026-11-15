import { z } from "zod";

const slug = z
  .string()
  .trim()
  .min(2, "Slug minimal 2 karakter.")
  .max(120, "Slug maksimal 120 karakter.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Gunakan huruf kecil, angka, dan tanda hubung.")
  .transform((value) => value.toLowerCase());

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(max).nullable().optional(),
  );

const optionalId = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.coerce.number().int().positive().nullable().optional(),
);

const requiredId = z.coerce.number().int().positive({ message: "ID tidak valid." });

const imageUrl = z
  .string()
  .trim()
  .min(1, "Gambar wajib diisi.")
  .max(500, "URL gambar terlalu panjang.")
  .refine(
    (value) => value.startsWith("/") || /^https?:\/\//i.test(value),
    "Gunakan path lokal (/) atau URL http(s).",
  );

const dataUrl = z
  .string()
  .max(12_000_000, "Ukuran gambar terlalu besar.")
  .regex(
    /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/,
    "Format gambar harus PNG, JPG, atau WEBP.",
  );

const booleanValue = z.boolean();

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100),
  email: z.string().trim().toLowerCase().email("Email tidak valid.").max(190),
  password: z.string().min(8, "Password minimal 8 karakter.").max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid."),
  password: z.string().min(1, "Password wajib diisi."),
});

export const userCreateSchema = registerSchema.extend({
  role: z.enum(["USER", "ADMIN"]).default("USER"),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().toLowerCase().email().max(190).optional(),
  password: z.string().min(8).max(100).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
});

export const frameCreateSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100),
  slug,
  description: optionalText(255),
  imageUrl,
  slotCount: z.union([z.literal(3), z.literal(4)]).default(4),
  isActive: booleanValue.default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const frameUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  slug: slug.optional(),
  description: optionalText(255),
  imageUrl: imageUrl.optional(),
  slotCount: z.union([z.literal(3), z.literal(4)]).optional(),
  isActive: booleanValue.optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const filterCreateSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100),
  slug,
  description: optionalText(255),
  cssFilter: z.string().trim().min(1, "Filter CSS wajib diisi.").max(255),
  isActive: booleanValue.default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const filterUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  slug: slug.optional(),
  description: optionalText(255),
  cssFilter: z.string().trim().min(1).max(255).optional(),
  isActive: booleanValue.optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const sessionCreateSchema = z.object({
  frameId: optionalId,
  filterId: optionalId,
  photoCount: z.union([z.literal(3), z.literal(4)]).default(4),
  userId: optionalId,
});

export const sessionUpdateSchema = z.object({
  frameId: optionalId,
  filterId: optionalId,
  photoCount: z.union([z.literal(3), z.literal(4)]).optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  userId: optionalId,
});

export const photoCreateSchema = z
  .object({
    sessionId: optionalId,
    sessionCode: z.string().trim().uuid().optional(),
    position: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    dataUrl: dataUrl.optional(),
    imageUrl: imageUrl.optional(),
  })
  .refine((value) => Boolean(value.dataUrl || value.imageUrl), {
    message: "dataUrl atau imageUrl wajib diisi.",
    path: ["dataUrl"],
  });

export const photoUpdateSchema = z.object({
  position: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  dataUrl: dataUrl.optional(),
  imageUrl: imageUrl.optional(),
});

export const stripCreateSchema = z
  .object({
    sessionId: optionalId,
    sessionCode: z.string().trim().uuid().optional(),
    dataUrl: dataUrl.optional(),
    imageUrl: imageUrl.optional(),
    caption: optionalText(160),
    isPublic: booleanValue.default(true),
  })
  .refine((value) => Boolean(value.dataUrl || value.imageUrl), {
    message: "dataUrl atau imageUrl wajib diisi.",
    path: ["dataUrl"],
  });

export const stripUpdateSchema = z.object({
  imageUrl: imageUrl.optional(),
  caption: optionalText(160),
  isPublic: booleanValue.optional(),
});

export const downloadCreateSchema = z.object({
  photoStripId: requiredId,
  userId: optionalId,
});

export const downloadUpdateSchema = z.object({
  photoStripId: requiredId.optional(),
  userId: optionalId,
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type FrameCreateInput = z.infer<typeof frameCreateSchema>;
export type FilterCreateInput = z.infer<typeof filterCreateSchema>;
export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;
export type PhotoCreateInput = z.infer<typeof photoCreateSchema>;
export type StripCreateInput = z.infer<typeof stripCreateSchema>;
export type DownloadCreateInput = z.infer<typeof downloadCreateSchema>;
