import fs from "node:fs";
import path from "node:path";
import process from "node:process";

process.loadEnvFile(".env.local");

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const mode = process.argv[2] ?? "create";
const artifactPath = process.argv[3] ?? "test-artifacts/api-test-ids.json";
const stamp = Date.now().toString(36);
const frameSlug = `smoke-frame-${stamp}`;
const filterSlug = `smoke-filter-${stamp}`;
const testEmail = `smoke.${stamp}@snapbooth.test`;
const testPassword = `Smoke-${stamp}-Pass!`;
const unknownId = 999999999;
const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const imageDataUrl = `data:image/png;base64,${pngBase64}`;

let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) passed += 1;
  else failed += 1;
  console.log(`${condition ? "PASS" : "FAIL"} | ${label}${detail ? ` | ${detail}` : ""}`);
  return Boolean(condition);
}

function status(label, response, expected) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  const ok = allowed.includes(response.status);
  return check(
    label,
    ok,
    `HTTP ${response.status}${ok ? "" : ` (diharapkan ${allowed.join("/")}) body=${response.text.slice(0, 220)}`}`,
  );
}

function fieldError(response, key) {
  return Boolean(response.json?.details?.fieldErrors?.[key]);
}

async function api(pathname, options = {}) {
  const { method = "GET", body, cookie } = options;
  const headers = {};
  if (cookie) headers.cookie = cookie;
  let payload;
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers,
    body: payload,
    redirect: "manual",
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const text = buffer.toString("utf8");
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  const setCookies =
    typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  const rawCookie = setCookies[0] ?? response.headers.get("set-cookie");
  return {
    status: response.status,
    headers: response.headers,
    buffer,
    text,
    json,
    cookie: rawCookie ? rawCookie.split(";")[0] : null,
  };
}

async function waitForServer() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch(BASE_URL, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // Server belum siap.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server tidak merespons di ${BASE_URL}`);
}

function saveIds(ids) {
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(
    artifactPath,
    `${JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        stamp,
        testEmail,
        frameSlug,
        filterSlug,
        ...ids,
      },
      null,
      2,
    )}\n`,
  );
}

function uniquePush(list, value) {
  if (Number.isInteger(value) && value > 0 && !list.includes(value)) list.push(value);
}

async function login(email, password) {
  const response = await api("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  return { response, cookie: response.cookie };
}

async function createMode() {
  const ids = {
    userIds: [],
    frameIds: [],
    filterIds: [],
    sessionIds: [],
    photoIds: [],
    stripIds: [],
    downloadIds: [],
  };

  try {
    await waitForServer();
    status("Landing dapat diakses", await api("/"), 200);
    status("Gallery dapat diakses", await api("/gallery"), 200);
    status("Photo Booth dapat diakses", await api("/booth"), 200);
    status("Halaman login dapat diakses", await api("/login"), 200);

    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    const demoEmail = process.env.SEED_DEMO_EMAIL;
    const demoPassword = process.env.SEED_DEMO_PASSWORD;
    if (!adminEmail || !adminPassword || !demoEmail || !demoPassword) {
      throw new Error("Env seed admin/demo belum lengkap.");
    }

    const badLogin = await api("/api/auth/login", {
      method: "POST",
      body: { email: "tidak-ada@snapbooth.test", password: "salah-total" },
    });
    status("Login dengan kredensial salah ditolak", badLogin, 401);

    const adminLogin = await login(adminEmail, adminPassword);
    status("Login admin berhasil", adminLogin.response, 200);
    check(
      "Cookie sesi admin diterbitkan",
      Boolean(adminLogin.cookie?.startsWith("snapbooth_session=")),
      adminLogin.cookie ? "cookie HttpOnly diterima" : "cookie tidak ada",
    );
    const adminCookie = adminLogin.cookie;
    if (!adminCookie) throw new Error("Cookie admin tidak tersedia.");

    const adminMe = await api("/api/auth/me", { cookie: adminCookie });
    status("Sesi admin dapat dibaca", adminMe, 200);
    check("Peran admin terverifikasi", adminMe.json?.data?.role === "ADMIN", `peran=${adminMe.json?.data?.role ?? "-"}`);

    const adminPageAnonymous = await api("/admin");
    status("Dashboard admin tanpa login dialihkan", adminPageAnonymous, [307, 308]);
    const adminPage = await api("/admin", { cookie: adminCookie });
    status("Dashboard admin terbuka untuk admin", adminPage, 200);
    check("HTML dashboard admin dirender", adminPage.text.includes("Kelola SnapBooth"));

    const historyAnonymous = await api("/history");
    check(
      "Riwayat tanpa login mengarahkan ke halaman login",
      [307, 308].includes(historyAnonymous.status) ||
        historyAnonymous.text.includes("/login?next=/history"),
      `HTTP ${historyAnonymous.status}${historyAnonymous.text.includes("/login?next=/history") ? " + payload redirect" : ""}`,
    );

    const framePayload = {
      name: `Smoke Frame ${stamp}`,
      slug: frameSlug,
      description: "Frame verifikasi otomatis.",
      imageUrl: "/frames/soft-bloom.svg",
      slotCount: 3,
      isActive: true,
      sortOrder: 999,
    };

    status(
      "POST frame tanpa login ditolak 401",
      await api("/api/frames", { method: "POST", body: framePayload }),
      401,
    );

    const invalidFrame = await api("/api/frames", {
      method: "POST",
      cookie: adminCookie,
      body: {},
    });
    status("POST frame tidak valid ditolak 400", invalidFrame, 400);
    check("Validasi frame mengembalikan fieldErrors", fieldError(invalidFrame, "name"));

    const createdFrame = await api("/api/frames", {
      method: "POST",
      cookie: adminCookie,
      body: framePayload,
    });
    status("POST frame valid membuat data 201", createdFrame, 201);
    const frameId = Number(createdFrame.json?.data?.id);
    check("ID frame diterima", Number.isInteger(frameId) && frameId > 0, `id=${frameId}`);
    uniquePush(ids.frameIds, frameId);
    saveIds(ids);
    if (!frameId) throw new Error("Frame test tidak berhasil dibuat.");

    const frameDetail = await api(`/api/frames/${frameId}`);
    status("GET frame berdasarkan id", frameDetail, 200);
    check("Data frame sesuai", frameDetail.json?.data?.slug === frameSlug);

    const updatedFrame = await api(`/api/frames/${frameId}`, {
      method: "PUT",
      cookie: adminCookie,
      body: { name: `Smoke Frame Updated ${stamp}`, description: null },
    });
    status("PUT frame memperbarui data", updatedFrame, 200);
    check(
      "Nama frame berubah",
      String(updatedFrame.json?.data?.name ?? "").startsWith("Smoke Frame Updated"),
    );

    const frameSearch = await api(`/api/frames?search=${encodeURIComponent(frameSlug)}&limit=10`);
    status("GET frames mendukung search", frameSearch, 200);
    check("Hasil search memuat frame test", Number(frameSearch.json?.meta?.total) >= 1);

    const duplicateFrame = await api("/api/frames", {
      method: "POST",
      cookie: adminCookie,
      body: { ...framePayload, name: `Duplikat ${stamp}` },
    });
    status("POST frame dengan slug duplikat ditolak 409", duplicateFrame, 409);

    status("GET frame id tidak valid ditolak 400", await api("/api/frames/abc"), 400);
    status("GET frame yang tidak ada 404", await api(`/api/frames/${unknownId}`), 404);

    const filterPayload = {
      name: `Smoke Filter ${stamp}`,
      slug: filterSlug,
      description: "Filter verifikasi otomatis.",
      cssFilter: "saturate(1.08) hue-rotate(-4deg)",
      isActive: true,
      sortOrder: 999,
    };

    const invalidFilter = await api("/api/filters", {
      method: "POST",
      cookie: adminCookie,
      body: {},
    });
    status("POST filter tidak valid ditolak 400", invalidFilter, 400);
    check("Validasi filter mengembalikan fieldErrors", fieldError(invalidFilter, "cssFilter"));

    const createdFilter = await api("/api/filters", {
      method: "POST",
      cookie: adminCookie,
      body: filterPayload,
    });
    status("POST filter valid membuat data 201", createdFilter, 201);
    const filterId = Number(createdFilter.json?.data?.id);
    check("ID filter diterima", Number.isInteger(filterId) && filterId > 0, `id=${filterId}`);
    uniquePush(ids.filterIds, filterId);
    saveIds(ids);
    if (!filterId) throw new Error("Filter test tidak berhasil dibuat.");

    status("GET filter berdasarkan id", await api(`/api/filters/${filterId}`), 200);
    const updatedFilter = await api(`/api/filters/${filterId}`, {
      method: "PUT",
      cookie: adminCookie,
      body: { cssFilter: "saturate(1.2) sepia(0.05)" },
    });
    status("PUT filter memperbarui data", updatedFilter, 200);
    check("CSS filter berubah", updatedFilter.json?.data?.cssFilter === "saturate(1.2) sepia(0.05)");
    const filterSearch = await api(
      `/api/filters?search=${encodeURIComponent(filterSlug)}&limit=10`,
    );
    status("GET filters mendukung search", filterSearch, 200);
    check("Hasil search memuat filter test", Number(filterSearch.json?.meta?.total) >= 1);
    status("GET filter yang tidak ada 404", await api(`/api/filters/${unknownId}`), 404);

    const invalidUser = await api("/api/users", {
      method: "POST",
      cookie: adminCookie,
      body: { name: "A", email: "bukan-email", password: "pendek" },
    });
    status("POST pengguna tidak valid ditolak 400", invalidUser, 400);
    check("Validasi pengguna mengembalikan fieldErrors", fieldError(invalidUser, "email"));

    const createdUser = await api("/api/users", {
      method: "POST",
      cookie: adminCookie,
      body: { name: `Smoke User ${stamp}`, email: testEmail, password: testPassword, role: "USER" },
    });
    status("POST pengguna valid membuat data 201", createdUser, 201);
    const userId = Number(createdUser.json?.data?.id);
    check("ID pengguna diterima", Number.isInteger(userId) && userId > 0, `id=${userId}`);
    check(
      "Respons pengguna tidak memuat hash password",
      !("password" in (createdUser.json?.data ?? {})) &&
        !("password_hash" in (createdUser.json?.data ?? {})),
    );
    uniquePush(ids.userIds, userId);
    saveIds(ids);
    if (!userId) throw new Error("Pengguna test tidak berhasil dibuat.");

    const userList = await api(
      `/api/users?search=${encodeURIComponent(testEmail)}&limit=10`,
      { cookie: adminCookie },
    );
    status("GET users (admin) mendukung search", userList, 200);
    check("Daftar pengguna memuat akun test", Number(userList.json?.meta?.total) >= 1);
    check(
      "Daftar pengguna tidak membocorkan hash password",
      (userList.json?.data ?? []).every(
        (row) => !("password" in row) && !("password_hash" in row),
      ),
    );

    const updatedUser = await api(`/api/users/${userId}`, {
      method: "PUT",
      cookie: adminCookie,
      body: { name: `Smoke User Updated ${stamp}` },
    });
    status("PUT pengguna memperbarui data", updatedUser, 200);
    check(
      "Nama pengguna berubah",
      String(updatedUser.json?.data?.name ?? "").startsWith("Smoke User Updated"),
    );

    const testUserLogin = await login(testEmail, testPassword);
    status("Login akun test berhasil", testUserLogin.response, 200);
    check(
      "Cookie sesi user diterbitkan",
      Boolean(testUserLogin.cookie?.startsWith("snapbooth_session=")),
    );
    const userCookie = testUserLogin.cookie;
    if (!userCookie) throw new Error("Cookie user test tidak tersedia.");

    const userMe = await api("/api/auth/me", { cookie: userCookie });
    status("Sesi user test dapat dibaca", userMe, 200);
    check("Peran user test adalah USER", userMe.json?.data?.role === "USER");
    status(
      "GET users dengan akun non-admin ditolak 403",
      await api("/api/users", { cookie: userCookie }),
      403,
    );
    status("GET user yang tidak ada 404", await api(`/api/users/${unknownId}`, { cookie: adminCookie }), 404);

    const sessionPayload = {
      userId,
      frameId,
      filterId,
      photoCount: 3,
    };
    status(
      "POST sesi dengan slot frame tidak cocok ditolak 400",
      await api("/api/photo-sessions", {
        method: "POST",
        cookie: adminCookie,
        body: { ...sessionPayload, photoCount: 4 },
      }),
      400,
    );

    const createdSession = await api("/api/photo-sessions", {
      method: "POST",
      cookie: adminCookie,
      body: sessionPayload,
    });
    status("POST sesi foto valid membuat data 201", createdSession, 201);
    const sessionId = Number(createdSession.json?.data?.id);
    const sessionCode = String(createdSession.json?.data?.sessionCode ?? "");
    check("ID sesi diterima", Number.isInteger(sessionId) && sessionId > 0, `id=${sessionId}`);
    check("Sesi dimiliki pengguna test", Number(createdSession.json?.data?.userId) === userId);
    check("Sesi baru berstatus ACTIVE", createdSession.json?.data?.status === "ACTIVE");
    uniquePush(ids.sessionIds, sessionId);
    saveIds(ids);
    if (!sessionId || !sessionCode) throw new Error("Sesi foto test tidak berhasil dibuat.");

    status(
      "GET sesi tanpa login ditolak 403",
      await api(`/api/photo-sessions/${sessionId}`),
      403,
    );
    status(
      "GET sesi sebagai pemilik berhasil",
      await api(`/api/photo-sessions/${sessionId}`, { cookie: userCookie }),
      200,
    );
    status(
      "GET sesi yang tidak ada 404",
      await api(`/api/photo-sessions/${unknownId}`, { cookie: adminCookie }),
      404,
    );

    const invalidPhoto = await api("/api/photos", {
      method: "POST",
      cookie: adminCookie,
      body: { sessionId, position: 1 },
    });
    status("POST foto tanpa gambar ditolak 400", invalidPhoto, 400);
    check("Validasi foto mengembalikan fieldErrors", fieldError(invalidPhoto, "dataUrl"));

    for (let position = 1; position <= 3; position += 1) {
      const createdPhoto = await api("/api/photos", {
        method: "POST",
        cookie: adminCookie,
        body: { sessionId, position, dataUrl: imageDataUrl },
      });
      status(`POST foto posisi ${position}`, createdPhoto, 201);
      const photoId = Number(createdPhoto.json?.data?.id);
      check(`ID foto posisi ${position} diterima`, Number.isInteger(photoId) && photoId > 0, `id=${photoId}`);
      uniquePush(ids.photoIds, photoId);
      saveIds(ids);
    }
    if (ids.photoIds.length !== 3) throw new Error("Foto test tidak lengkap.");

    const updatedPhoto = await api(`/api/photos/${ids.photoIds[2]}`, {
      method: "PUT",
      cookie: adminCookie,
      body: { position: 4 },
    });
    status("PUT foto memperbarui posisi", updatedPhoto, 200);
    check("Posisi foto berubah menjadi 4", Number(updatedPhoto.json?.data?.position) === 4);
    status(
      "GET foto sebagai admin",
      await api(`/api/photos/${ids.photoIds[0]}`, { cookie: adminCookie }),
      200,
    );
    status(
      "GET foto tanpa akses ditolak 403",
      await api(`/api/photos/${ids.photoIds[0]}`),
      403,
    );
    status(
      "GET foto yang tidak ada 404",
      await api(`/api/photos/${unknownId}`, { cookie: adminCookie }),
      404,
    );

    const invalidStrip = await api("/api/photo-strips", {
      method: "POST",
      cookie: adminCookie,
      body: { sessionId },
    });
    status("POST photo strip tanpa gambar ditolak 400", invalidStrip, 400);

    const createdStrip = await api("/api/photo-strips", {
      method: "POST",
      cookie: adminCookie,
      body: {
        sessionId,
        dataUrl: imageDataUrl,
        caption: `Smoke Strip ${stamp}`,
        isPublic: true,
      },
    });
    status("POST photo strip valid membuat data 201", createdStrip, 201);
    const stripId = Number(createdStrip.json?.data?.id);
    uniquePush(ids.stripIds, stripId);
    saveIds(ids);
    if (!stripId) throw new Error("Photo strip test tidak berhasil dibuat.");

    const completedSession = await api(`/api/photo-sessions/${sessionId}`, {
      cookie: adminCookie,
    });
    status("GET sesi setelah strip dibuat", completedSession, 200);
    check("Sesi otomatis berstatus COMPLETED", completedSession.json?.data?.status === "COMPLETED");

    const duplicateStrip = await api("/api/photo-strips", {
      method: "POST",
      cookie: adminCookie,
      body: { sessionId, dataUrl: imageDataUrl },
    });
    status("POST strip ganda untuk sesi yang sama ditolak 409", duplicateStrip, 409);

    const stripDetail = await api(`/api/photo-strips/${stripId}`);
    status("GET photo strip publik tanpa login", stripDetail, 200);
    check("Strip test tampil publik", stripDetail.json?.data?.isPublic === true);

    const stripSearch = await api(
      `/api/photo-strips?public=1&search=${encodeURIComponent(`Smoke Strip ${stamp}`)}&limit=10`,
    );
    status("GET photo-strips publik mendukung search", stripSearch, 200);
    check(
      "Hasil search memuat strip test",
      (stripSearch.json?.data ?? []).some((row) => Number(row.id) === stripId),
    );

    const updatedStrip = await api(`/api/photo-strips/${stripId}`, {
      method: "PUT",
      cookie: adminCookie,
      body: { caption: `Smoke Strip Updated ${stamp}` },
    });
    status("PUT photo strip memperbarui caption", updatedStrip, 200);
    check(
      "Caption strip berubah",
      String(updatedStrip.json?.data?.caption ?? "").startsWith("Smoke Strip Updated"),
    );
    status("GET photo strip yang tidak ada 404", await api(`/api/photo-strips/${unknownId}`), 404);

    const downloadFile = await api(`/api/photo-strips/${stripId}/download`, {
      cookie: userCookie,
    });
    status("GET unduhan file photo strip", downloadFile, 200);
    check(
      "File unduhan adalah PNG",
      String(downloadFile.headers.get("content-type") ?? "").includes("image/png"),
      `content-type=${downloadFile.headers.get("content-type") ?? "-"}`,
    );
    check(
      "Header attachment tersedia",
      String(downloadFile.headers.get("content-disposition") ?? "").includes("attachment"),
    );
    check("Ukuran file unduhan lebih dari 0", downloadFile.buffer.length > 0, `${downloadFile.buffer.length} byte`);
    status(
      "GET unduhan strip yang tidak ada 404",
      await api(`/api/photo-strips/${unknownId}/download`),
      404,
    );

    const createdDownload = await api("/api/downloads", {
      method: "POST",
      cookie: adminCookie,
      body: { photoStripId: stripId, userId },
    });
    status("POST unduhan valid membuat data 201", createdDownload, 201);
    uniquePush(ids.downloadIds, Number(createdDownload.json?.data?.id));

    const myDownloads = await api("/api/downloads?mine=1&limit=50", {
      cookie: userCookie,
    });
    status("GET riwayat unduhan user", myDownloads, 200);
    check("Riwayat memuat unduhan strip test", Number(myDownloads.json?.meta?.total) >= 1);
    for (const row of myDownloads.json?.data ?? []) {
      if (Number(row.photoStripId) === stripId) uniquePush(ids.downloadIds, Number(row.id));
    }
    saveIds(ids);
    check("ID unduhan tercatat minimal 2", ids.downloadIds.length >= 2, `${ids.downloadIds.length} baris`);

    const firstDownloadId = ids.downloadIds[0];
    if (!firstDownloadId) throw new Error("ID unduhan test tidak tersedia.");
    status(
      "GET unduhan sebagai admin",
      await api(`/api/downloads/${firstDownloadId}`, { cookie: adminCookie }),
      200,
    );
    status(
      "GET unduhan sebagai pemilik",
      await api(`/api/downloads/${firstDownloadId}`, { cookie: userCookie }),
      200,
    );
    status(
      "GET unduhan tanpa login ditolak 401",
      await api(`/api/downloads/${firstDownloadId}`),
      401,
    );
    const updatedDownload = await api(`/api/downloads/${firstDownloadId}`, {
      method: "PUT",
      cookie: adminCookie,
      body: { userId },
    });
    status("PUT unduhan memperbarui data", updatedDownload, 200);
    check("Relasi pengguna unduhan sesuai", Number(updatedDownload.json?.data?.userId) === userId);
    status(
      "GET unduhan yang tidak ada 404",
      await api(`/api/downloads/${unknownId}`, { cookie: adminCookie }),
      404,
    );

    const adminDownloadList = await api(
      `/api/downloads?search=${encodeURIComponent(`Smoke Strip Updated ${stamp}`)}&limit=10`,
      { cookie: adminCookie },
    );
    status("GET downloads admin mendukung search", adminDownloadList, 200);
    check(
      "Daftar unduhan admin memuat data test",
      (adminDownloadList.json?.data ?? []).some((row) => Number(row.photoStripId) === stripId),
    );

    const gallerySearch = await api(
      `/gallery?search=${encodeURIComponent(`Smoke Strip Updated ${stamp}`)}`,
    );
    status("Halaman gallery menampilkan pencarian", gallerySearch, 200);
    check("HTML gallery memuat caption strip test", gallerySearch.text.includes(`Smoke Strip Updated ${stamp}`));

    const historyPage = await api("/history", { cookie: userCookie });
    status("Halaman riwayat unduhan user terbuka", historyPage, 200);
    check("HTML riwayat memuat caption strip test", historyPage.text.includes(`Smoke Strip Updated ${stamp}`));

    const finalAdminList = await api("/api/users?limit=10", { cookie: adminCookie });
    status("GET users admin terakhir", finalAdminList, 200);
    check(
      "Pagination mengembalikan meta lengkap",
      Number.isInteger(finalAdminList.json?.meta?.page) &&
        Number.isInteger(finalAdminList.json?.meta?.total),
    );

    saveIds(ids);
  } catch (error) {
    failed += 1;
    console.error(`FATAL | ${error instanceof Error ? error.message : String(error)}`);
    saveIds(ids);
  }

  console.log(`\nRingkasan create: ${passed} PASS, ${failed} FAIL`);
  console.log(`ID test disimpan di ${artifactPath}`);
  if (failed > 0) process.exitCode = 1;
}

async function cleanupMode() {
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`File ID test tidak ditemukan: ${artifactPath}`);
  }
  const ids = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  try {
    await waitForServer();
    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) throw new Error("Env seed admin belum lengkap.");

    const adminLogin = await login(adminEmail, adminPassword);
    status("Login admin untuk cleanup", adminLogin.response, 200);
    const adminCookie = adminLogin.cookie;
    if (!adminCookie) throw new Error("Cookie admin cleanup tidak tersedia.");

    for (const id of ids.downloadIds ?? []) {
      status(`GET unduhan #${id} sebelum hapus`, await api(`/api/downloads/${id}`, { cookie: adminCookie }), 200);
      status(`DELETE unduhan #${id}`, await api(`/api/downloads/${id}`, { method: "DELETE", cookie: adminCookie }), 200);
      status(`GET unduhan #${id} setelah hapus`, await api(`/api/downloads/${id}`, { cookie: adminCookie }), 404);
    }

    for (const id of ids.photoIds ?? []) {
      status(`DELETE foto #${id}`, await api(`/api/photos/${id}`, { method: "DELETE", cookie: adminCookie }), 200);
      status(`GET foto #${id} setelah hapus`, await api(`/api/photos/${id}`, { cookie: adminCookie }), 404);
    }

    for (const id of ids.stripIds ?? []) {
      status(`GET strip #${id} sebelum hapus`, await api(`/api/photo-strips/${id}`, { cookie: adminCookie }), 200);
      status(`DELETE strip #${id}`, await api(`/api/photo-strips/${id}`, { method: "DELETE", cookie: adminCookie }), 200);
      status(`GET strip #${id} setelah hapus`, await api(`/api/photo-strips/${id}`, { cookie: adminCookie }), 404);
    }

    for (const id of ids.sessionIds ?? []) {
      status(`DELETE sesi #${id}`, await api(`/api/photo-sessions/${id}`, { method: "DELETE", cookie: adminCookie }), 200);
      status(`GET sesi #${id} setelah hapus`, await api(`/api/photo-sessions/${id}`, { cookie: adminCookie }), 404);
    }

    for (const id of ids.userIds ?? []) {
      status(`DELETE pengguna #${id}`, await api(`/api/users/${id}`, { method: "DELETE", cookie: adminCookie }), 200);
      status(`GET pengguna #${id} setelah hapus`, await api(`/api/users/${id}`, { cookie: adminCookie }), 404);
    }

    for (const id of ids.filterIds ?? []) {
      status(`DELETE filter #${id}`, await api(`/api/filters/${id}`, { method: "DELETE", cookie: adminCookie }), 200);
      status(`GET filter #${id} setelah hapus`, await api(`/api/filters/${id}`), 404);
    }

    for (const id of ids.frameIds ?? []) {
      status(`DELETE frame #${id}`, await api(`/api/frames/${id}`, { method: "DELETE", cookie: adminCookie }), 200);
      status(`GET frame #${id} setelah hapus`, await api(`/api/frames/${id}`), 404);
    }

    const testStamp =
      ids.stamp ?? (String(ids.frameSlug ?? "").replace("smoke-frame-", "") || stamp);
    const finalGallery = await api(
      `/api/photo-strips?public=1&search=${encodeURIComponent(`Smoke Strip Updated ${testStamp}`)}&limit=10`,
    );
    status("GET photo strip publik setelah cleanup", finalGallery, 200);
    check(
      "Tidak ada strip test tersisa",
      !(finalGallery.json?.data ?? []).some((row) => ids.stripIds?.includes(Number(row.id))),
    );

    console.log(`\nRingkasan cleanup: ${passed} PASS, ${failed} FAIL`);
  } catch (error) {
    failed += 1;
    console.error(`FATAL | ${error instanceof Error ? error.message : String(error)}`);
  }

  if (failed > 0) process.exitCode = 1;
}

if (mode === "create") await createMode();
else if (mode === "cleanup") await cleanupMode();
else {
  console.error("Mode harus create atau cleanup.");
  process.exitCode = 1;
}
