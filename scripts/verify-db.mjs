import mysql from "mysql2/promise";
import process from "node:process";

process.loadEnvFile(".env.local");

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

try {
  const [tables] = await db.query("SHOW TABLES");
  console.log("SHOW TABLES:");
  for (const row of tables) console.log(`- ${Object.values(row)[0]}`);

  const tableNames = tables.map((row) => Object.values(row)[0]);
  for (const table of tableNames) {
    const [columns] = await db.query(`DESCRIBE \`${table}\``);
    console.log(`\nDESCRIBE ${table}:`);
    for (const column of columns) {
      console.log(
        `  ${column.Field} | ${column.Type} | null=${column.Null} | key=${column.Key || "-"} | default=${column.Default ?? "NULL"} | extra=${column.Extra || "-"}`,
      );
    }
  }

  console.log("\nCOUNT baris:");
  for (const table of tableNames) {
    const [[row]] = await db.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
    console.log(`- ${table}: ${row.total}`);
  }
} finally {
  await db.end();
}
