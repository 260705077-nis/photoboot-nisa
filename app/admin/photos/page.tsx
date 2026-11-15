"use client";

import { ResourceManager, type AdminColumn, type AdminField } from "@/components/admin/ResourceManager";
import { Thumb } from "@/components/admin/Cells";
import { formatDate } from "@/lib/format";

const columns: AdminColumn[] = [
  { key: "id", label: "ID" },
  { key: "imageUrl", label: "Foto", render: (row) => <Thumb src={row.imageUrl} /> },
  { key: "sessionCode", label: "Sesi", render: (row) => <span className="text-xs">{String(row.sessionCode ?? "—").slice(0, 8)}…</span> },
  { key: "position", label: "Posisi" },
  { key: "createdAt", label: "Dibuat", render: (row) => <span className="text-xs">{formatDate(String(row.createdAt))}</span> },
];

const fields: AdminField[] = [
  { key: "sessionId", label: "ID sesi", type: "number", requiredOnCreate: true, editHidden: true, min: 1 },
  { key: "position", label: "Posisi foto", type: "select", required: true, valueType: "number", defaultValue: 1, options: [{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }] },
  { key: "imageUrl", label: "URL foto", type: "text", required: true, placeholder: "/uploads/photos/…", help: "Gunakan path lokal atau URL gambar publik." },
];

export default function AdminPhotosPage() {
  return (
    <ResourceManager
      resource="photos"
      title="Foto"
      description="Data foto individual yang membentuk photo strip. Posisi 1–4 unik di dalam satu sesi."
      columns={columns}
      fields={fields}
      createLabel="Tambah Foto"
      searchPlaceholder="Cari kode sesi atau URL foto…"
      defaultSort="created_at"
      sortOptions={[
        { value: "created_at", label: "Terbaru" },
        { value: "position", label: "Posisi" },
      ]}
    />
  );
}
