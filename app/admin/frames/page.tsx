"use client";

import { ResourceManager, type AdminColumn, type AdminField } from "@/components/admin/ResourceManager";
import { StatusBadge, Thumb } from "@/components/admin/Cells";
import { formatDate } from "@/lib/format";

const columns: AdminColumn[] = [
  { key: "id", label: "ID" },
  { key: "imageUrl", label: "Preview", render: (row) => <Thumb src={row.imageUrl} contain /> },
  { key: "name", label: "Nama" },
  { key: "slug", label: "Slug" },
  { key: "slotCount", label: "Foto", render: (row) => `${String(row.slotCount)} foto` },
  { key: "isActive", label: "Status", render: (row) => <StatusBadge value={Boolean(row.isActive)} labels={["Aktif", "Nonaktif"]} /> },
  { key: "sortOrder", label: "Urutan" },
  { key: "updatedAt", label: "Diperbarui", render: (row) => <span className="text-xs">{formatDate(String(row.updatedAt))}</span> },
];

const fields: AdminField[] = [
  { key: "name", label: "Nama frame", type: "text", required: true, placeholder: "Pink Classic" },
  { key: "slug", label: "Slug", type: "text", required: true, placeholder: "pink-classic", help: "Huruf kecil dan tanda hubung." },
  { key: "description", label: "Deskripsi", type: "textarea", placeholder: "Nuansa pink lembut dengan aksen maroon." },
  { key: "imageUrl", label: "URL gambar frame", type: "text", required: true, placeholder: "/frames/pink-classic.svg", help: "Gunakan aset lokal di public/frames agar aman saat canvas membuat strip." },
  { key: "slotCount", label: "Jumlah slot", type: "select", required: true, valueType: "number", defaultValue: 4, options: [{ value: "3", label: "3 foto" }, { value: "4", label: "4 foto" }] },
  { key: "sortOrder", label: "Urutan tampil", type: "number", defaultValue: 0, min: 0 },
  { key: "isActive", label: "Aktifkan frame", type: "checkbox", defaultValue: true, help: "Frame aktif tampil di Photo Booth." },
];

export default function AdminFramesPage() {
  return (
    <ResourceManager
      resource="frames"
      title="Frame"
      description="Kelola bingkai photo strip yang tampil di Photo Booth. Frame dengan slot 3/4 harus cocok dengan jumlah foto."
      columns={columns}
      fields={fields}
      createLabel="Tambah Frame"
      searchPlaceholder="Cari nama atau slug frame…"
      defaultSort="created_at"
      sortOptions={[
        { value: "created_at", label: "Terbaru" },
        { value: "name", label: "Nama" },
        { value: "sort_order", label: "Urutan" },
      ]}
    />
  );
}
