import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mysql from "mysql2/promise";

process.loadEnvFile(".env.local");

const apply = process.argv.includes("--apply");
const roots = [
  path.resolve("storage", "uploads"),
  path.resolve("public", "uploads"),
].filter((root) => fs.existsSync(root));

if (roots.length === 0) {
  console.log("Tidak ada folder upload.");
  process.exit(0);
}

const url = new URL(process.env.DATABASE_URL);
const db = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
  ssl: { rejectUnauthorized: false },
  dateStrings: true,
});

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const referenced = new Set();
const removed = [];
let kept = 0;

try {
  const [rows] = await db.query(
    `SELECT image_url FROM photos
     UNION
     SELECT image_url FROM photo_strips
     UNION
     SELECT image_url FROM frames`,
  );
  for (const row of rows) {
    const value = String(row.image_url ?? "").split("?")[0];
    if (value.startsWith("/uploads/")) referenced.add(value);
  }

  for (const root of roots) {
    for (const filePath of walk(root)) {
      const relative = path.relative(root, filePath).split(path.sep).join("/");
      const assetUrl = `/uploads/${relative}`;
      if (referenced.has(assetUrl)) {
        kept += 1;
        continue;
      }
      removed.push({ assetUrl, filePath });
      if (apply) fs.unlinkSync(filePath);
    }
  }
} finally {
  await db.end();
}

console.log(`${apply ? "Dihapus" : "Akan dihapus"}: ${removed.length} file`);
for (const item of removed) console.log(`- ${item.assetUrl}`);
console.log(`Dirujuk database dan dipertahankan: ${kept} file`);
if (!apply && removed.length > 0) {
  console.log("\nJalankan ulang dengan --apply untuk menghapus file di atas.");
}
