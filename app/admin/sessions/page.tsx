"use client";

import { ResourceManager, type AdminColumn, type AdminField } from "@/components/admin/ResourceManager";
import { formatDate } from "@/lib/format";

const statusClass: Record<string, string> = {
  ACTIVE: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-rose-50 text-rose-700",
};

const columns: AdminColumn[] = [
  { key: "id", label: "ID" },
  { key: "sessionCode", label: "Kode sesi", render: (row) => <code className="rounded bg-blush/30 px-2 py-1 text-[11px]" title={String(row.sessionCode)}>{String(row.sessionCode).slice(0, 8)}…</code> },
  { key: "userName", label: "Pengguna", render: (row) => String(row.userName ?? "Tamu") },
  { key: "frameName", label: "Frame", render: (row) => String(row.frameName ?? "—") },
  { key: "photoCount", label: "Foto" },
  { key: "status", label: "Status", render: (row) => <span className={`badge ${statusClass[String(row.status)] ?? "bg-blush/50 text-plum/60"}`}>{String(row.status)}</span> },
  { key: "createdAt", label: "Dibuat", render: (row) => <span className="text-xs">{formatDate(String(row.createdAt))}</span> },
];

const fields: AdminField[] = [
  { key: "userId", label: "ID pengguna", type: "number", min: 1, help: "Opsional. Kosongkan untuk sesi tamu." },
  { key: "frameId", label: "ID frame", type: "number", min: 1, help: "Opsional. Jumlah foto harus cocok dengan slot frame." },
  { key: "filterId", label: "ID filter", type: "number", min: 1 },
  { key: "photoCount", label: "Jumlah foto", type: "select", required: true, valueType: "number", defaultValue: 4, options: [{ value: "3", label: "3 foto" }, { value: "4", label: "4 foto" }] },
  { key: "status", label: "Status", type: "select", createHidden: true, options: [{ value: "ACTIVE", label: "Active" }, { value: "COMPLETED", label: "Completed" }, { value: "CANCELLED", label: "Cancelled" }] },
];

export default function AdminSessionsPage() {
  return (
    <ResourceManager
      resource="photo-sessions"
      title="Sesi Foto"
      description="Pantau sesi photo booth. Menghapus sesi juga menghapus foto, strip, dan riwayat unduhan terkait."
      columns={columns}
      fields={fields}
      createLabel="Tambah Sesi"
      searchPlaceholder="Cari kode sesi, pengguna, atau frame…"
      defaultSort="created_at"
      sortOptions={[
        { value: "created_at", label: "Terbaru" },
        { value: "status", label: "Status" },
      ]}
    />
  );
}
