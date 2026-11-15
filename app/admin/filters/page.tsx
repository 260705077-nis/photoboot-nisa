"use client";

import { ResourceManager, type AdminColumn, type AdminField } from "@/components/admin/ResourceManager";
import { StatusBadge } from "@/components/admin/Cells";
import { formatDate } from "@/lib/format";

const columns: AdminColumn[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Nama" },
  { key: "slug", label: "Slug" },
  { key: "cssFilter", label: "CSS Filter", render: (row) => <code className="rounded bg-blush/30 px-2 py-1 text-[11px]">{String(row.cssFilter)}</code> },
  { key: "isActive", label: "Status", render: (row) => <StatusBadge value={Boolean(row.isActive)} labels={["Aktif", "Nonaktif"]} /> },
  { key: "sortOrder", label: "Urutan" },
  { key: "updatedAt", label: "Diperbarui", render: (row) => <span className="text-xs">{formatDate(String(row.updatedAt))}</span> },
];

const fields: AdminField[] = [
  { key: "name", label: "Nama filter", type: "text", required: true, placeholder: "Soft Pink" },
  { key: "slug", label: "Slug", type: "text", required: true, placeholder: "soft-pink" },
  { key: "description", label: "Deskripsi", type: "textarea", placeholder: "Rona pink hangat dan lembut." },
  { key: "cssFilter", label: "Nilai CSS filter", type: "text", required: true, placeholder: "saturate(1.1) sepia(0.12) brightness(1.04)", help: "Dipakai untuk preview dan canvas photo strip." },
  { key: "sortOrder", label: "Urutan tampil", type: "number", defaultValue: 0, min: 0 },
  { key: "isActive", label: "Aktifkan filter", type: "checkbox", defaultValue: true },
];

export default function AdminFiltersPage() {
  return (
    <ResourceManager
      resource="filters"
      title="Filter"
      description="Atur efek warna yang tersedia di Photo Booth. Nilai CSS filter diterapkan langsung ke preview dan hasil akhir."
      columns={columns}
      fields={fields}
      createLabel="Tambah Filter"
      searchPlaceholder="Cari nama atau slug filter…"
      defaultSort="created_at"
      sortOptions={[
        { value: "created_at", label: "Terbaru" },
        { value: "name", label: "Nama" },
        { value: "sort_order", label: "Urutan" },
      ]}
    />
  );
}
