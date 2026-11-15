# SnapBooth

Photo booth online dengan tema soft pink, putih, dan maroon. Ambil foto lewat kamera, ikuti countdown, ulangi foto tertentu, susun photo strip, simpan ke gallery, lalu unduh hasilnya.

## Status

Selesai dan terverifikasi pada 15 November 2026.

- Landing page, Photo Booth, Gallery publik, Riwayat Unduhan, Login, Register, dan Dashboard Admin.
- Auth custom: scrypt + cookie HttpOnly `snapbooth_session`, guard `requireUser`/`requireAdmin`.
- CRUD lengkap untuk users, frames, filters, photo sessions, photos, photo strips, dan downloads.
- Kamera, countdown, retake per foto, komposisi strip 600×1900, simpan, unduh, gallery, dan riwayat.
- Admin responsive: tabel di desktop berubah menjadi kartu di bawah 768px.
- Loading, empty, dan error state; validasi inline; konfirmasi hapus.
- Upload gambar disimpan di `storage/uploads`, disajikan lewat route `app/uploads/[...path]/route.ts`, dan file fisik ikut dihapus saat data dihapus.

## Stack

- Next.js 16 App Router + React 19 + TypeScript
- Tailwind CSS 4
- MySQL Aiven + `mysql2`
- Zod untuk validasi request
- Playwright Core + Microsoft Edge untuk verifikasi UI/E2E

## Menjalankan

1. Salin `.env.example` menjadi `.env.local`, lalu isi kredensial Aiven dan seed.
2. Install dependency:

   ```powershell
   cmd /c "npm install"
   ```

3. Buat/cek database, schema, dan seed:

   ```powershell
   cmd /c "npm run db:check"
   cmd /c "npm run db:schema"
   cmd /c "npm run db:seed"
   cmd /c "npm run db:verify"
   ```

4. Jalankan development atau produksi:

   ```powershell
   cmd /c "npm run dev"
   ```

   ```powershell
   cmd /c "npm run build"
   cmd /c "npm start"
   ```

Buka `http://localhost:3000`.

Kredensial admin dan demo hanya dibaca dari `.env.local`; jangan commit file tersebut.

## Perintah Verifikasi

```powershell
cmd /c "npm run typecheck"
cmd /c "npm run lint"
cmd /c "npm run build"

# API create + cleanup (server harus aktif)
cmd /c "npm run test:api"
node scripts/verify-test-data.mjs test-artifacts/api-test-ids.json
cmd /c "npm run test:api:cleanup"
node scripts/verify-test-data.mjs test-artifacts/api-test-ids.json

# UI responsive + screenshot + login admin
cmd /c "npm run test:ui"

# E2E kamera palsu: countdown, 4 foto, retake, strip, unduh, gallery, riwayat
cmd /c "npm run test:e2e"

# Hapus file upload yang tidak lagi dirujuk database
node scripts/cleanup-uploads.mjs
cmd /c "npm run uploads:cleanup"
```

Screenshot dan artifact test tersimpan di `test-artifacts/` (diabaikan Git). File upload lokal tersimpan di `storage/uploads/` (diabaikan Git).

## Bukti Verifikasi Terakhir

- `npm run typecheck`: lolos tanpa error.
- `npm run lint`: lolos tanpa error/warning.
- `npm run build`: sukses, termasuk route dinamis `/uploads/[...path]`.
- API smoke create: **109 PASS, 0 FAIL**.
- API smoke cleanup: **26 PASS, 0 FAIL**.
- UI check 375px dan 1440px: **56 PASS, 0 FAIL**, tanpa page/console error.
- E2E kamera palsu: **35 PASS, 0 FAIL**.
  - Countdown tampil, 4 foto diambil, retake berhasil.
  - Preview dan file unduhan berukuran **600×1900**.
  - Strip tersimpan, tampil di gallery dan riwayat, gambar termuat **600×1900**.
- Data test API dan E2E kembali **0 baris** setelah cleanup.
- File upload test kembali **0 file** setelah cleanup; URL file hasil cleanup mengembalikan **HTTP 404**.
- Seed database utuh setelah cleanup: users 2, frames 4, filters 4, photo_sessions 1, photos 4, photo_strips 1, downloads 1.

Screenshot utama ada di:

- `test-artifacts/ui/375-landing.png`
- `test-artifacts/ui/375-booth.png`
- `test-artifacts/ui/375-gallery.png`
- `test-artifacts/ui/375-admin.png`
- `test-artifacts/ui/375-admin-users.png`
- `test-artifacts/ui/e2e-strip-result.png`
- `test-artifacts/ui/e2e-strip-download.png`
- `test-artifacts/ui/e2e-gallery.png`
- `test-artifacts/ui/e2e-history.png`

## Struktur Singkat

```text
app/
  api/                 REST API + auth
  admin/               Dashboard admin
  booth/               Photo booth
  gallery/             Gallery publik
  history/             Riwayat unduhan
  login/, register/    Auth UI
  uploads/[...path]/   Penyaji file upload runtime
components/
  booth/               Kamera, countdown, retake, komposisi strip
  admin/               ResourceManager CRUD generik
lib/
  auth.ts              Session, scrypt, guard
  db.ts                Pool MySQL
  uploads.ts           Simpan/hapus/sajikan file upload
  validators.ts        Schema Zod
scripts/               Schema, seed, verifikasi, smoke test, UI/E2E
storage/uploads/       File upload lokal (ignored)
```

## Keamanan dan Data

- Password di-hash dengan scrypt dan salt acak; hash tidak pernah dikirim di respons API.
- Cookie sesi HttpOnly, SameSite Lax, dan Secure di production.
- Endpoint download dibatasi untuk admin atau pemilik data.
- Semua endpoint mutasi memakai validasi Zod dan status HTTP yang sesuai.
- Perubahan schema bersifat additive; script tidak menjalankan `DROP`/`TRUNCATE`.
- `.env*` dikecualikan dari Git, termasuk `.env.local`.
