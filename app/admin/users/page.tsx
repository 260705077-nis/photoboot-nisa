"use client";

import { ResourceManager, type AdminColumn, type AdminField } from "@/components/admin/ResourceManager";
import { formatDate } from "@/lib/format";

const columns: AdminColumn[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Nama" },
  { key: "email", label: "Email" },
  {
    key: "role",
    label: "Peran",
    render: (row) => (
      <span className={`badge ${row.role === "ADMIN" ? "bg-maroon text-white" : "bg-blush/60 text-maroon"}`}>
        {String(row.role)}
      </span>
    ),
  },
  { key: "createdAt", label: "Dibuat", render: (row) => <span className="text-xs">{formatDate(String(row.createdAt))}</span> },
];

const fields: AdminField[] = [
  { key: "name", label: "Nama", type: "text", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "password", label: "Password", type: "password", requiredOnCreate: true, omitIfBlank: true, minLength: 8, help: "Kosongkan saat edit jika tidak ingin mengubah password." },
  { key: "role", label: "Peran", type: "select", required: true, defaultValue: "USER", options: [{ value: "USER", label: "User" }, { value: "ADMIN", label: "Admin" }] },
];

export default function AdminUsersPage() {
  return (
    <ResourceManager
      resource="users"
      title="Pengguna"
      description="Kelola akun yang bisa masuk ke SnapBooth. Akun admin dapat mengakses dashboard ini."
      columns={columns}
      fields={fields}
      createLabel="Tambah Pengguna"
      searchPlaceholder="Cari nama atau email…"
      defaultSort="created_at"
      sortOptions={[
        { value: "created_at", label: "Terbaru" },
        { value: "name", label: "Nama" },
        { value: "email", label: "Email" },
      ]}
    />
  );
}
