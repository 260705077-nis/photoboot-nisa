import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright-core";

process.loadEnvFile(".env.local");

const BASE_URL = process.env.UI_BASE_URL ?? "http://localhost:3000";
const outputDir = path.resolve("test-artifacts/ui");
const idsPath = path.resolve("test-artifacts/e2e-booth-ids.json");
const caption = `E2E Kamera ${Date.now()}`;
const browserPath =
  process.env.UI_BROWSER_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

fs.mkdirSync(outputDir, { recursive: true });

let passed = 0;
let failed = 0;
const ids = {
  sessionIds: [],
  photoIds: [],
  stripIds: [],
  downloadIds: [],
};

function check(label, condition, detail = "") {
  if (condition) passed += 1;
  else failed += 1;
  console.log(`${condition ? "PASS" : "FAIL"} | ${label}${detail ? ` | ${detail}` : ""}`);
  return Boolean(condition);
}

function saveIds(extra = {}) {
  fs.writeFileSync(
    idsPath,
    `${JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        caption,
        ...ids,
        ...extra,
      },
      null,
      2,
    )}\n`,
  );
}

async function api(pathname, cookie) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    headers: cookie ? { cookie } : undefined,
    redirect: "manual",
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

async function loginApi(email, password) {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  const raw = response.headers.getSetCookie?.()[0] ?? response.headers.get("set-cookie");
  return {
    status: response.status,
    cookie: raw ? raw.split(";")[0] : null,
  };
}

const browser = await chromium.launch({
  executablePath: browserPath,
  headless: true,
  args: [
    "--disable-gpu",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--hide-scrollbars",
  ],
});

let context;
try {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) throw new Error("Env seed admin belum lengkap.");

  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    locale: "id-ID",
    permissions: ["camera"],
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const loginResponse = await page.goto(`${BASE_URL}/login?next=/booth`, {
    waitUntil: "networkidle",
  });
  check("Halaman login E2E dapat diakses", loginResponse?.status() === 200);
  await page.fill("#email", adminEmail);
  await page.fill("#password", adminPassword);
  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/login") && response.request().method() === "POST",
  );
  await page.locator('button[type="submit"]').click();
  check("Login API E2E berhasil", (await loginResponsePromise).status() === 200);
  await page.waitForURL((url) => url.pathname === "/booth");
  await page.waitForLoadState("networkidle");
  check("Berada di halaman Photo Booth", new URL(page.url()).pathname === "/booth");

  await page.getByRole("button", { name: "Pilih frame Maroon Elegance" }).click();
  const filterButton = page.getByRole("button", { name: /Warm Glow/ });
  await filterButton.click();
  check("Frame Maroon Elegance dipilih", true);
  check("Filter Warm Glow dipilih", true);

  await page.getByRole("button", { name: /Nyalakan kamera/ }).click();
  await page.getByText("Kamera siap!").waitFor({ timeout: 30000 });
  check("Kamera palsu berhasil aktif", true);

  await page.getByRole("button", { name: /Mulai ambil foto/ }).click();
  const countdown = page.locator('[aria-live="assertive"]');
  await countdown.waitFor({ state: "visible", timeout: 10000 });
  check("Countdown tampil sebelum foto", true);
  await page.getByRole("heading", { name: "Sudah pas semua?" }).waitFor({ timeout: 60000 });
  check("Empat foto berhasil diambil", true);
  check("Tombol ulangi tersedia untuk setiap foto", (await page.getByRole("button", { name: "Ulangi" }).count()) === 4);

  await page.getByRole("button", { name: "Ulangi" }).first().click();
  await page.getByText("Siap-siap…").waitFor({ timeout: 10000 });
  await page.getByRole("heading", { name: "Sudah pas semua?" }).waitFor({ timeout: 30000 });
  check("Retake satu foto berhasil", true);

  await page.getByRole("button", { name: "Buat Photo Strip" }).click();
  await page.getByText("Cantik banget!").waitFor({ timeout: 30000 });
  check("Photo strip berhasil dikomposisi di browser", true);

  const preview = page.getByAltText("Hasil photo strip");
  check("Preview photo strip tampil", await preview.isVisible());
  const previewInfo = await preview.evaluate((image) => ({
    width: image.naturalWidth,
    height: image.naturalHeight,
    complete: image.complete,
  }));
  check(
    "Preview strip berukuran 600x1900",
    previewInfo.complete && previewInfo.width === 600 && previewInfo.height === 1900,
    `${previewInfo.width}x${previewInfo.height}`,
  );
  await page.screenshot({ path: path.join(outputDir, "e2e-strip-result.png"), fullPage: false });

  await page.fill("#caption", caption);
  await page.getByRole("button", { name: "Simpan ke Gallery" }).click();
  const savedBanner = page.getByText(/Tersimpan sebagai photo strip #\d+/);
  await savedBanner.waitFor({ timeout: 60000 });
  const savedText = await savedBanner.innerText();
  const stripId = Number(savedText.match(/#(\d+)/)?.[1]);
  check("Strip tersimpan ke database", Number.isInteger(stripId) && stripId > 0, savedText);
  if (!stripId) throw new Error("ID strip hasil UI tidak ditemukan.");
  ids.stripIds.push(stripId);
  saveIds();

  const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
  await page.getByRole("link", { name: /Unduh Photo Strip/ }).click();
  const download = await downloadPromise;
  const downloadPath = path.join(outputDir, "e2e-strip-download.png");
  await download.saveAs(downloadPath);
  const file = fs.readFileSync(downloadPath);
  const isPng = file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const width = file.length >= 24 ? file.readUInt32BE(16) : 0;
  const height = file.length >= 24 ? file.readUInt32BE(20) : 0;
  check("File strip terunduh", file.length > 1000, `${file.length} byte`);
  check("File unduhan berformat PNG", isPng);
  check("Dimensi file unduhan 600x1900", width === 600 && height === 1900, `${width}x${height}`);
  check(
    "Nama file unduhan masuk akal",
    download.suggestedFilename().endsWith(".png"),
    download.suggestedFilename(),
  );

  const adminLogin = await loginApi(adminEmail, adminPassword);
  check("Login API untuk verifikasi data berhasil", adminLogin.status === 200);
  if (!adminLogin.cookie) throw new Error("Cookie admin verifikasi tidak tersedia.");
  const adminCookie = adminLogin.cookie;

  const stripList = await api(
    `/api/photo-strips?search=${encodeURIComponent(caption)}&limit=10`,
    adminCookie,
  );
  check("API menemukan strip hasil UI", stripList.status === 200);
  const stripRow = (stripList.json?.data ?? []).find((row) => Number(row.id) === stripId);
  check("Data strip di API sesuai", Boolean(stripRow), `strip #${stripId}`);
  if (!stripRow) throw new Error("Strip hasil UI tidak ditemukan di API.");
  const sessionId = Number(stripRow.sessionId);
  ids.sessionIds.push(sessionId);
  saveIds();

  const sessionDetail = await api(`/api/photo-sessions/${sessionId}`, adminCookie);
  check("Sesi foto hasil UI ditemukan", sessionDetail.status === 200);
  check(
    "Sesi hasil UI berstatus COMPLETED",
    sessionDetail.json?.data?.status === "COMPLETED",
  );
  const sessionCode = String(sessionDetail.json?.data?.sessionCode ?? "");
  check("Session code tersedia", sessionCode.length === 36);

  const photoList = await api(
    `/api/photos?search=${encodeURIComponent(sessionCode)}&limit=20`,
    adminCookie,
  );
  check("API menemukan foto hasil UI", photoList.status === 200);
  for (const row of photoList.json?.data ?? []) {
    if (Number(row.sessionId) === sessionId) ids.photoIds.push(Number(row.id));
  }
  check("Empat foto tersimpan di database", ids.photoIds.length === 4, `${ids.photoIds.length} foto`);
  saveIds();

  const downloadList = await api(
    `/api/downloads?search=${encodeURIComponent(caption)}&limit=20`,
    adminCookie,
  );
  check("API menemukan catatan unduhan hasil UI", downloadList.status === 200);
  for (const row of downloadList.json?.data ?? []) {
    if (Number(row.photoStripId) === stripId) ids.downloadIds.push(Number(row.id));
  }
  check("Unduhan tercatat di database", ids.downloadIds.length >= 1, `${ids.downloadIds.length} baris`);
  saveIds();

  const galleryResponse = await page.goto(
    `${BASE_URL}/gallery?search=${encodeURIComponent(caption)}`,
    { waitUntil: "networkidle" },
  );
  check("Halaman gallery hasil E2E dapat diakses", galleryResponse?.status() === 200);
  await page.getByText(caption).first().waitFor({ timeout: 15000 });
  check("Caption strip tampil di gallery", true);
  const galleryImage = page.getByAltText(`Photo strip: ${caption}`).first();
  await galleryImage.waitFor({ state: "visible", timeout: 15000 });
  const galleryImageInfo = await galleryImage.evaluate((image) => ({
    complete: image.complete,
    width: image.naturalWidth,
    height: image.naturalHeight,
  }));
  check(
    "Gambar strip termuat di gallery",
    galleryImageInfo.complete && galleryImageInfo.width > 0 && galleryImageInfo.height > 0,
    `${galleryImageInfo.width}x${galleryImageInfo.height}`,
  );
  await page.screenshot({ path: path.join(outputDir, "e2e-gallery.png"), fullPage: false });

  const historyResponse = await page.goto(`${BASE_URL}/history`, { waitUntil: "networkidle" });
  check("Halaman riwayat hasil E2E dapat diakses", historyResponse?.status() === 200);
  await page.getByText(caption).first().waitFor({ timeout: 15000 });
  check("Caption strip tampil di riwayat unduhan", true);
  const historyImage = page.getByAltText(caption).first();
  await historyImage.waitFor({ state: "visible", timeout: 15000 });
  const historyImageInfo = await historyImage.evaluate((image) => ({
    complete: image.complete,
    width: image.naturalWidth,
    height: image.naturalHeight,
  }));
  check(
    "Gambar strip termuat di riwayat unduhan",
    historyImageInfo.complete && historyImageInfo.width > 0 && historyImageInfo.height > 0,
    `${historyImageInfo.width}x${historyImageInfo.height}`,
  );
  await page.screenshot({ path: path.join(outputDir, "e2e-history.png"), fullPage: false });

  check(
    "Tidak ada page error selama alur kamera",
    pageErrors.length === 0,
    pageErrors.length ? pageErrors.slice(0, 3).join(" | ") : "0 error",
  );
} catch (error) {
  failed += 1;
  console.error(`FATAL | ${error instanceof Error ? error.message : String(error)}`);
  try {
    if (context) {
      const pages = context.pages();
      if (pages[0]) {
        await pages[0].screenshot({
          path: path.join(outputDir, "e2e-failure.png"),
          fullPage: false,
        });
      }
    }
  } catch {
    // Screenshot kegagalan bersifat best effort.
  }
} finally {
  saveIds();
  await browser.close();
  console.log(`\nRingkasan E2E kamera: ${passed} PASS, ${failed} FAIL`);
  console.log(`ID E2E disimpan di ${idsPath}`);
  if (failed > 0) process.exitCode = 1;
}
