import mysql from "mysql2/promise";
import process from "node:process";

process.loadEnvFile(".env.local");

const url = new URL(process.env.DATABASE_URL);
const connection = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  ssl: { rejectUnauthorized: false },
  connectTimeout: 15000,
});

try {
  await connection.query(
    "CREATE DATABASE IF NOT EXISTS web_snapbooth CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
  );
  const [rows] = await connection.query("SHOW DATABASES LIKE 'web_snapbooth'");
  console.log("Database dibuat/ditemukan:", rows);
} finally {
  await connection.end();
}
