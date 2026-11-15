import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

const globalForDb = globalThis as unknown as { snapboothPool?: Pool };

function createPool(): Pool {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error("DATABASE_URL belum diatur");
  }

  const url = new URL(rawUrl);
  return mysql.createPool({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 8,
    queueLimit: 0,
    charset: "utf8mb4",
    dateStrings: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
}

export const db = globalForDb.snapboothPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.snapboothPool = db;
}

export type { Pool, PoolConnection, ResultSetHeader, RowDataPacket };
