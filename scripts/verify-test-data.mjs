import fs from "node:fs";
import process from "node:process";
import mysql from "mysql2/promise";

process.loadEnvFile(".env.local");

const idsPath = process.argv[2];
if (!idsPath) {
  console.error("Path ID test wajib diberikan.");
  process.exit(1);
}
const ids = JSON.parse(fs.readFileSync(idsPath, "utf8"));
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

const checks = [
  ["users", "SELECT id, name, email, role, created_at FROM users WHERE id IN (?)", [ids.userIds]],
  ["frames", "SELECT id, name, slug, slot_count, is_active FROM frames WHERE id IN (?)", [ids.frameIds]],
  ["filters", "SELECT id, name, slug, css_filter FROM filters WHERE id IN (?)", [ids.filterIds]],
  ["photo_sessions", "SELECT id, session_code, user_id, frame_id, filter_id, photo_count, status FROM photo_sessions WHERE id IN (?)", [ids.sessionIds]],
  ["photos", "SELECT id, session_id, position, image_url FROM photos WHERE id IN (?)", [ids.photoIds]],
  ["photo_strips", "SELECT id, session_id, image_url, caption, is_public FROM photo_strips WHERE id IN (?)", [ids.stripIds]],
  ["downloads", "SELECT id, photo_strip_id, user_id, created_at FROM downloads WHERE id IN (?)", [ids.downloadIds]],
];

try {
  for (const [table, sql, params] of checks) {
    const values = params[0];
    if (!Array.isArray(values) || values.length === 0) {
      console.log(`\n${table}: tidak ada ID test`);
      continue;
    }
    const [rows] = await db.query(sql, [values]);
    console.log(`\n${table}: ${rows.length} baris ditemukan`);
    for (const row of rows) console.log(JSON.stringify(row));
  }
} finally {
  await db.end();
}
