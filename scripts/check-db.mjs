import mysql from "mysql2/promise";
import process from "node:process";

process.loadEnvFile(".env.local");

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  console.error("DATABASE_URL tidak ditemukan di .env.local");
  process.exit(1);
}

const url = new URL(rawUrl);
const connection = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
  ssl: { rejectUnauthorized: false },
  connectTimeout: 15000,
});

try {
  const [ping] = await connection.query("SELECT 1 AS ok");
  const [[version]] = await connection.query("SELECT VERSION() AS version");
  const [databases] = await connection.query("SHOW DATABASES");

  console.log("SELECT 1:", ping[0]);
  console.log("Versi server:", version.version);
  console.log("Databases:");
  for (const row of databases) console.log(`- ${Object.values(row)[0]}`);
} catch (error) {
  console.error("Koneksi gagal:", error.code || error.message);
  process.exitCode = 1;
} finally {
  await connection.end();
}
