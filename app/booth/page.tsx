import type { Metadata } from "next";
import { PhotoBooth } from "@/components/booth/PhotoBooth";
import { getCurrentUser } from "@/lib/auth";
import { db, type RowDataPacket } from "@/lib/db";
import { mapFilter, mapFrame } from "@/lib/mappers";
import type { Filter, Frame } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Photo Booth",
  description: "Ambil 3–4 foto dengan kamera, pilih frame dan filter, lalu simpan photo strip.",
};

async function getBoothData(): Promise<{ frames: Frame[]; filters: Filter[] }> {
  try {
    const [frameRows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM frames WHERE is_active = 1 ORDER BY sort_order ASC, id ASC",
    );
    const [filterRows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM filters WHERE is_active = 1 ORDER BY sort_order ASC, id ASC",
    );
    return { frames: frameRows.map(mapFrame), filters: filterRows.map(mapFilter) };
  } catch {
    return { frames: [], filters: [] };
  }
}

export default async function BoothPage() {
  const [data, user] = await Promise.all([getBoothData(), getCurrentUser()]);

  return <PhotoBooth frames={data.frames} filters={data.filters} user={user} />;
}
