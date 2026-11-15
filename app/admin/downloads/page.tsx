"use client";

import { ResourceManager, type AdminColumn, type AdminField } from "@/components/admin/ResourceManager";
import { Thumb } from "@/components/admin/Cells";
import { formatDate } from "@/lib/format";

const columns: AdminColumn[] = [
  { key: "id", label: "ID" },
  { key: "imageUrl", label: "Strip", render: (row) => <Thumb src={row.imageUrl} contain /> },
  { key: "photoStripId", label: "ID strip" },
  { key: "userName", label: "Pengguna", render: (row) => String(row.userName ?? "Tamu") },
  { key: "createdAt", label: "Diunduh", render: (row) => <span className="text-xs">{formatDate(String(row.createdAt))}</span> },
];

const fields: AdminField[] = [
  { key: "photoStripId", label: "ID photo strip", type: "number", required: true, min: 1 },
  { key: "userId", label: "ID pengguna", type: "number", min: 1, help: "Kosongkan untuk unduhan tamu." },
];

export default function AdminDownloadsPage() {
  return (
    <ResourceManager
      resource="downloads"
      title="Unduhan"
      description="Catatan unduhan photo strip. Setiap aksi unduh dari gallery atau riwayat akan menambah baris baru."
      columns={columns}
      fields={fields}
      createLabel="Tambah Unduhan"
      searchPlaceholder="Cari caption atau pengguna…"
      defaultSort="created_at"
      sortOptions={[{ value: "created_at", label: "Terbaru" }]}
    />
  );
}
