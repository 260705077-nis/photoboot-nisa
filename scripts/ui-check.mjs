import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright-core";

process.loadEnvFile(".env.local");

const BASE_URL = process.env.UI_BASE_URL ?? "http://localhost:3000";
const outputDir = path.resolve("test-artifacts/ui");
const browserPath =
  process.env.UI_BROWSER_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

fs.mkdirSync(outputDir, { recursive: true });

let passed = 0;
let failed = 0;
const summaries = [];

function check(label, condition, detail = "") {
  if (condition) passed += 1;
  else failed += 1;
  console.log(`${condition ? "PASS" : "FAIL"} | ${label}${detail ? ` | ${detail}` : ""}`);
  return Boolean(condition);
}

function slugFor(route, width) {
  const routeName = route === "/" ? "landing" : route.replace(/^\//, "").replace(/\//g, "-");
  return `${width}-${routeName}.png`;
}

async function imageAudit(page) {
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.images).map((image) =>
        image.decode ? image.decode().catch(() => undefined) : Promise.resolve(undefined),
      ),
    );
  });
  return page.evaluate(() =>
    Array.from(document.images)
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.getAttribute("src") ?? "(tanpa src)"),
  );
}

async function navigationAudit(page, label, screenshotName) {
  await page.waitForLoadState("networkidle");
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  check(
    `${label}: tidak ada overflow horizontal`,
    dimensions.scrollWidth <= dimensions.innerWidth + 1,
    `scrollWidth=${dimensions.scrollWidth}, viewport=${dimensions.innerWidth}`,
  );
  check(
    `${label}: heading utama terlihat`,
    await page.locator("h1").first().isVisible().catch(() => false),
  );
  const brokenImages = await imageAudit(page);
  check(
    `${label}: semua gambar termuat`,
    brokenImages.length === 0,
    brokenImages.length > 0 ? brokenImages.join(", ") : "0 gambar rusak",
  );
  const screenshotPath = path.join(outputDir, screenshotName);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  summaries.push({ label, screenshotPath, viewport: dimensions.innerWidth });
  console.log(`SHOT | ${screenshotPath}`);
}

const browser = await chromium.launch({
  executablePath: browserPath,
  headless: true,
  args: ["--disable-gpu", "--hide-scrollbars"],
});

try {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) throw new Error("Env seed admin belum lengkap.");

  const consoleErrors = [];
  const pageErrors = [];

  for (const width of [375, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 375 ? 812 : 900 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      locale: "id-ID",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(`${width}px: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") {
        const location = message.location();
        consoleErrors.push(
          `${width}px: ${message.text()}${location.url ? ` (${location.url})` : ""}`,
        );
      }
    });

    for (const route of ["/", "/booth", "/gallery", "/login"]) {
      const response = await page.goto(`${BASE_URL}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      check(
        `${width}px ${route}: HTTP ${response?.status() ?? "-"}`,
        response?.status() === 200,
      );
      await navigationAudit(page, `${width}px ${route}`, slugFor(route, width));
    }

    await context.close();
  }

  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    locale: "id-ID",
  });
  const adminPage = await adminContext.newPage();
  adminPage.on("pageerror", (error) => pageErrors.push(`admin: ${error.message}`));
  adminPage.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      consoleErrors.push(
        `admin: ${message.text()}${location.url ? ` (${location.url})` : ""}`,
      );
    }
  });

  const loginResponse = await adminPage.goto(`${BASE_URL}/login?next=/admin`, {
    waitUntil: "networkidle",
  });
  check("Admin: halaman login dapat diakses", loginResponse?.status() === 200);
  await adminPage.fill("#email", adminEmail);
  await adminPage.fill("#password", adminPassword);
  const loginApiPromise = adminPage.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/login") && response.request().method() === "POST",
    { timeout: 20000 },
  );
  await adminPage.locator('button[type="submit"]').click();
  const loginApiResponse = await loginApiPromise;
  check("Admin: API login merespons 200", loginApiResponse.status() === 200);
  await adminPage.waitForURL((url) => url.pathname === "/admin", { timeout: 20000 });
  await adminPage.waitForLoadState("networkidle");
  check(
    "Admin: login lewat UI berhasil",
    new URL(adminPage.url()).pathname === "/admin",
    adminPage.url(),
  );
  await navigationAudit(adminPage, "1440px /admin", "1440-admin.png");

  await adminPage.goto(`${BASE_URL}/admin/users`, { waitUntil: "networkidle" });
  await adminPage.getByText("Admin SnapBooth").first().waitFor({ timeout: 20000 });
  await navigationAudit(adminPage, "1440px /admin/users", "1440-admin-users.png");
  check("Admin desktop: tabel terlihat", await adminPage.locator(".table-wrap").isVisible());
  check(
    "Admin desktop: kartu mobile tersembunyi",
    !(await adminPage.locator("article").first().isVisible().catch(() => false)),
  );

  await adminPage.setViewportSize({ width: 375, height: 812 });
  await adminPage.reload({ waitUntil: "networkidle" });
  await adminPage.getByText("Admin SnapBooth").first().waitFor({ timeout: 20000 });
  await navigationAudit(adminPage, "375px /admin/users", "375-admin-users.png");
  check(
    "Admin mobile: tabel tidak terlihat",
    !(await adminPage.locator(".table-wrap").isVisible().catch(() => true)),
  );
  check(
    "Admin mobile: kartu data terlihat",
    await adminPage.locator("article").first().isVisible().catch(() => false),
  );

  await adminPage.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
  await navigationAudit(adminPage, "375px /admin", "375-admin.png");

  await adminPage.goto(`${BASE_URL}/history`, { waitUntil: "networkidle" });
  await navigationAudit(adminPage, "375px /history", "375-history.png");

  await adminContext.close();

  check(
    "Tidak ada page error JavaScript",
    pageErrors.length === 0,
    pageErrors.length ? pageErrors.slice(0, 3).join(" | ") : "0 error",
  );
  check(
    "Tidak ada console error",
    consoleErrors.length === 0,
    consoleErrors.length ? consoleErrors.slice(0, 3).join(" | ") : "0 error",
  );

  fs.writeFileSync(
    path.join(outputDir, "ui-check.json"),
    `${JSON.stringify({ createdAt: new Date().toISOString(), passed, failed, summaries }, null, 2)}\n`,
  );
  console.log(`\nRingkasan UI: ${passed} PASS, ${failed} FAIL`);
  console.log(`Screenshot tersimpan di ${outputDir}`);
} catch (error) {
  failed += 1;
  console.error(`FATAL | ${error instanceof Error ? error.message : String(error)}`);
  if (failed > 0) process.exitCode = 1;
} finally {
  await browser.close();
}

if (failed > 0) process.exitCode = 1;
