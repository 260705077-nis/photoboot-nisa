"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/ToastProvider";

export type AdminRow = { id: number } & Record<string, unknown>;

export type AdminField = {
  key: string;
  label: string;
  type: "text" | "email" | "password" | "textarea" | "number" | "select" | "checkbox";
  required?: boolean;
  requiredOnCreate?: boolean;
  omitIfBlank?: boolean;
  createHidden?: boolean;
  editHidden?: boolean;
  placeholder?: string;
  help?: string;
  options?: Array<{ value: string; label: string }>;
  valueType?: "string" | "number";
  min?: number;
  max?: number;
  minLength?: number;
  defaultValue?: string | number | boolean;
};

export type AdminColumn = {
  key: string;
  label: string;
  render?: (row: AdminRow) => ReactNode;
  hideOnMobile?: boolean;
};

type Meta = { page: number; limit: number; total: number; totalPages: number };

type Props = {
  resource: string;
  title: string;
  description: string;
  columns: AdminColumn[];
  fields: AdminField[];
  createLabel?: string;
  searchPlaceholder?: string;
  defaultSort?: string;
  sortOptions?: Array<{ value: string; label: string }>;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
};

type FormValue = string | boolean;
type ApiError = { error?: string; details?: { fieldErrors?: Record<string, string[]> } };

function initialValues(fields: AdminField[], row: AdminRow | null): Record<string, FormValue> {
  const values: Record<string, FormValue> = {};
  for (const field of fields) {
    const value = row ? row[field.key] : field.defaultValue;
    if (field.type === "checkbox") {
      values[field.key] = Boolean(value);
    } else {
      values[field.key] = value === null || value === undefined ? "" : String(value);
    }
  }
  return values;
}

function renderCell(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-plum/30">—</span>;
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ResourceManager({
  resource,
  title,
  description,
  columns,
  fields,
  createLabel = "Tambah data",
  searchPlaceholder = "Cari data…",
  defaultSort,
  sortOptions,
  canCreate = true,
  canEdit = true,
  canDelete = true,
}: Props) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(defaultSort ?? sortOptions?.[0]?.value ?? "created_at");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRow | null>(null);
  const [values, setValues] = useState<Record<string, FormValue>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AdminRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams({
        page: String(page),
        limit: "10",
        sort,
        order: "desc",
      });
      if (search) query.set("search", search);

      try {
        const response = await fetch(`/api/${resource}?${query.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          data?: AdminRow[];
          meta?: Meta;
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error ?? "Data gagal dimuat.");
        if (!active) return;
        setRows(payload.data ?? []);
        if (payload.meta) setMeta(payload.meta);
      } catch (loadError) {
        if (!active || (loadError instanceof DOMException && loadError.name === "AbortError")) return;
        setError(loadError instanceof Error ? loadError.message : "Data gagal dimuat.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [resource, page, search, sort, reloadToken]);

  const visibleFields = useMemo(
    () => fields.filter((field) => (editing ? !field.editHidden : !field.createHidden)),
    [fields, editing],
  );

  function reload() {
    setReloadToken((value) => value + 1);
  }

  function openCreate() {
    setEditing(null);
    setValues(initialValues(fields, null));
    setFieldErrors({});
    setGeneralError(null);
    setFormOpen(true);
  }

  function openEdit(row: AdminRow) {
    setEditing(row);
    setValues(initialValues(fields, row));
    setFieldErrors({});
    setGeneralError(null);
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setGeneralError(null);
  }

  function validate(valuesToCheck: Record<string, FormValue>): boolean {
    const errors: Record<string, string[]> = {};
    for (const field of visibleFields) {
      if (field.type === "checkbox") continue;
      const raw = String(valuesToCheck[field.key] ?? "").trim();
      const isRequired = field.required || (!editing && field.requiredOnCreate);
      if (isRequired && raw.length === 0) {
        errors[field.key] = [`${field.label} wajib diisi.`];
        continue;
      }
      if (field.type === "email" && raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        errors[field.key] = ["Format email tidak valid."];
      }
      if (field.minLength && raw && raw.length < field.minLength) {
        errors[field.key] = [`Minimal ${field.minLength} karakter.`];
      }
      if ((field.type === "number" || field.valueType === "number") && raw) {
        const number = Number(raw);
        if (!Number.isFinite(number)) {
          errors[field.key] = ["Masukkan angka yang valid."];
        } else if (field.min !== undefined && number < field.min) {
          errors[field.key] = [`Minimal ${field.min}.`];
        } else if (field.max !== undefined && number > field.max) {
          errors[field.key] = [`Maksimal ${field.max}.`];
        }
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit() {
    setGeneralError(null);
    if (!validate(values)) return;

    const payload: Record<string, unknown> = {};
    for (const field of visibleFields) {
      const raw = values[field.key];
      if (field.type === "checkbox") {
        payload[field.key] = Boolean(raw);
        continue;
      }

      const text = String(raw ?? "").trim();
      if (text === "") {
        if (field.omitIfBlank) continue;
        if (field.type === "number" || field.valueType === "number") {
          payload[field.key] = null;
        } else {
          payload[field.key] = null;
        }
        continue;
      }

      if (field.type === "number" || field.valueType === "number") {
        payload[field.key] = Number(text);
      } else {
        payload[field.key] = text;
      }
    }

    setSaving(true);
    try {
      const url = editing ? `/api/${resource}/${editing.id}` : `/api/${resource}`;
      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as ApiError;
      if (!response.ok) {
        setFieldErrors(result.details?.fieldErrors ?? {});
        setGeneralError(result.error ?? "Data gagal disimpan.");
        return;
      }

      showToast(editing ? "Data berhasil diperbarui." : "Data berhasil ditambahkan.", "success");
      setFormOpen(false);
      setEditing(null);
      if (!editing) {
        setPage(1);
        setSearch("");
        setSearchInput("");
      }
      reload();
    } catch {
      setGeneralError("Tidak dapat menghubungi server.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/${resource}/${deleteTarget.id}`, { method: "DELETE" });
      const result = (await response.json().catch(() => ({}))) as ApiError;
      if (!response.ok) throw new Error(result.error ?? "Data gagal dihapus.");
      showToast("Data berhasil dihapus.", "success");
      setDeleteTarget(null);
      reload();
    } catch (deleteError) {
      showToast(deleteError instanceof Error ? deleteError.message : "Data gagal dihapus.", "error");
    } finally {
      setDeleting(false);
    }
  }

  function fieldError(key: string) {
    const messages = fieldErrors[key];
    if (!messages?.length) return null;
    return (
      <p id={`field-${key}-error`} className="mt-1.5 text-xs font-medium text-rose-700">
        {messages[0]}
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-3xl text-maroon">{title}</h2>
          <p className="muted mt-2 max-w-2xl">{description}</p>
        </div>
        {canCreate ? (
          <button type="button" onClick={openCreate} className="btn btn-primary shrink-0">
            + {createLabel}
          </button>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="flex flex-1 gap-2"
        >
          <label htmlFor={`search-${resource}`} className="sr-only">
            Cari {title}
          </label>
          <input
            id={`search-${resource}`}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="input"
            placeholder={searchPlaceholder}
          />
          <button type="submit" className="btn btn-secondary shrink-0">
            Cari
          </button>
        </form>
        {sortOptions?.length ? (
          <div className="flex items-center gap-2">
            <label htmlFor={`sort-${resource}`} className="text-xs font-semibold text-plum/50">
              Urutkan
            </label>
            <select
              id={`sort-${resource}`}
              value={sort}
              onChange={(event) => {
                setPage(1);
                setSort(event.target.value);
              }}
              className="input w-auto min-w-36 py-2.5"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Belum ada data"
            description={search ? `Tidak ada data yang cocok dengan “${search}”.` : "Tambahkan data pertama lewat tombol di atas."}
          />
        ) : (
          <>
            <div className="table-wrap hidden md:block">
              <table className="table-base">
                <thead>
                  <tr>
                    {columns.filter((column) => !column.hideOnMobile).map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={String(row.id)} className="transition hover:bg-blush/10">
                      {columns.filter((column) => !column.hideOnMobile).map((column) => (
                        <td key={column.key}>
                          {column.render ? column.render(row) : renderCell(row[column.key])}
                        </td>
                      ))}
                      <td>
                        <div className="flex justify-end gap-1.5">
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              className="rounded-full px-3 py-1.5 text-xs font-semibold text-maroon hover:bg-blush/40"
                            >
                              Edit
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(row)}
                              className="rounded-full px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              Hapus
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 md:hidden">
              {rows.map((row) => (
                <article key={String(row.id)} className="rounded-2xl border border-blush/70 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="badge bg-blush/50 text-maroon">#{String(row.id)}</span>
                    <div className="flex gap-1">
                      {canEdit ? (
                        <button type="button" onClick={() => openEdit(row)} className="btn btn-ghost px-3 py-1.5 text-xs">
                          Edit
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(row)}
                          className="btn btn-ghost px-3 py-1.5 text-xs text-rose-700"
                        >
                          Hapus
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <dl className="mt-3 grid gap-2">
                    {columns.filter((column) => !column.hideOnMobile).map((column) => (
                      <div key={column.key} className="grid grid-cols-[110px_1fr] gap-2 text-xs">
                        <dt className="font-semibold text-plum/45">{column.label}</dt>
                        <dd className="min-w-0 break-words text-plum">{column.render ? column.render(row) : renderCell(row[column.key])}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-5">
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onChange={setPage} />
      </div>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? `Edit ${title}` : `Tambah ${title}`}
        description={editing ? "Perubahan akan langsung tersimpan ke database." : "Isi data dengan lengkap."}
        size="lg"
        footer={
          <>
            <button type="button" onClick={closeForm} className="btn btn-secondary" disabled={saving}>
              Batal
            </button>
            <button type="button" onClick={() => void submit()} className="btn btn-primary" disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan"}
            </button>
          </>
        }
      >
        {generalError ? (
          <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {generalError}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {visibleFields.map((field) => {
            const isRequired = field.required || (!editing && field.requiredOnCreate);
            const errorId = `field-${field.key}-error`;
            const commonClass = "input";
            return (
              <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : undefined}>
                {field.type === "checkbox" ? (
                  <label className="flex items-start gap-3 rounded-2xl border border-blush bg-cream/50 px-4 py-3 text-sm text-plum/75">
                    <input
                      type="checkbox"
                      checked={Boolean(values[field.key])}
                      onChange={(event) =>
                        setValues((current) => ({ ...current, [field.key]: event.target.checked }))
                      }
                      className="mt-0.5 h-4 w-4 accent-[#5a1f31]"
                    />
                    <span>
                      <span className="font-semibold text-maroon">{field.label}</span>
                      {field.help ? <span className="mt-0.5 block text-xs text-plum/50">{field.help}</span> : null}
                    </span>
                  </label>
                ) : (
                  <>
                    <label htmlFor={`field-${field.key}`} className="label">
                      {field.label}
                      {isRequired ? <span className="ml-1 text-rose">*</span> : null}
                    </label>
                    {field.type === "textarea" ? (
                      <textarea
                        id={`field-${field.key}`}
                        value={String(values[field.key] ?? "")}
                        onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                        rows={3}
                        className={commonClass}
                        placeholder={field.placeholder}
                        aria-invalid={Boolean(fieldErrors[field.key])}
                        aria-describedby={fieldErrors[field.key] ? errorId : undefined}
                      />
                    ) : field.type === "select" ? (
                      <select
                        id={`field-${field.key}`}
                        value={String(values[field.key] ?? "")}
                        onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                        className={commonClass}
                        aria-invalid={Boolean(fieldErrors[field.key])}
                        aria-describedby={fieldErrors[field.key] ? errorId : undefined}
                      >
                        <option value="">Pilih {field.label.toLowerCase()}</option>
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`field-${field.key}`}
                        type={field.type}
                        value={String(values[field.key] ?? "")}
                        onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                        className={commonClass}
                        placeholder={field.placeholder}
                        min={field.min}
                        max={field.max}
                        minLength={field.minLength}
                        aria-invalid={Boolean(fieldErrors[field.key])}
                        aria-describedby={fieldErrors[field.key] ? errorId : undefined}
                      />
                    )}
                    {field.help ? <p className="mt-1.5 text-xs text-plum/45">{field.help}</p> : null}
                    {fieldError(field.key)}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => (!deleting ? setDeleteTarget(null) : undefined)}
        title="Hapus data?"
        description={`Data #${deleteTarget?.id ?? ""} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setDeleteTarget(null)} className="btn btn-secondary" disabled={deleting}>
              Batal
            </button>
            <button type="button" onClick={() => void confirmDelete()} className="btn btn-danger" disabled={deleting}>
              {deleting ? "Menghapus…" : "Ya, hapus"}
            </button>
          </>
        }
      >
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Pastikan data ini memang aman untuk dihapus.
        </div>
      </Modal>
    </div>
  );
}
