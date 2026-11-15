"use client";

import { ResourceManager, type AdminColumn, type AdminField } from "@/components/admin/ResourceManager";
import { StatusBadge, Thumb } from "@/components/admin/Cells";
import { formatDate } from "@/lib/format";

const columns: AdminColumn[] = [
  { key: "id", label: "ID" },
  { key: "imageUrl", label: "Strip", render: (row) => <Thumb src={row.imageUrl} contain /> },
  { key: "caption", label: "Caption", render: (row) => String(row.caption || "Untitled moment") },
  { key: "userName", label: "Pengguna", render: (row) => String(row.userName ?? "Tamu") },
  { key: "isPublic", label: "Gallery", render: (row) => <StatusBadge value={Boolean(row.isPublic)} labels={["Publik", "Privat"]} /> },
  { key: "createdAt", label: "Dibuat", render: (row) => <span className="text-xs">{formatDate(String(row.createdAt))}</span> },
];

const fields: AdminField[] = [
  { key: "sessionId", label: "ID sesi", type: "number", requiredOnCreate: true, editHidden: true, min: 1, help: "Satu sesi hanya boleh punya satu photo strip." },
  { key: "imageUrl", label: "URL photo strip", type: "text", required: true, placeholder: "/uploads/strips/…" },
  { key: "caption", label: "Caption", type: "text", placeholder: "Momen sore ini" },
  { key: "isPublic", label: "Tampilkan di gallery publik", type: "checkbox", defaultValue: true },
];

export default function AdminStripsPage() {
  return (
    <ResourceManager
      resource="photo-strips"
      title="Photo Strip"
      description="Hasil kolase final. Kamu bisa mengubah caption, visibilitas gallery, atau menghapus strip."
      columns={columns}
      fields={fields}
      createLabel="Tambah Photo Strip"
      searchPlaceholder="Cari caption atau kode sesi…"
      defaultSort="created_at"
      sortOptions={[
        { value: "created_at", label: "Terbaru" },
        { value: "caption", label: "Caption" },
      ]}
    />
  );
}
