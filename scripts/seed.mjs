import mysql from "mysql2/promise";
import crypto from "node:crypto";
import process from "node:process";

process.loadEnvFile(".env.local");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

const required = [
  "DATABASE_URL",
  "SEED_ADMIN_EMAIL",
  "SEED_ADMIN_PASSWORD",
  "SEED_DEMO_EMAIL",
  "SEED_DEMO_PASSWORD",
];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Env ${key} belum diisi`);
}

const url = new URL(process.env.DATABASE_URL);
const db = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
  ssl: { rejectUnauthorized: false },
  connectTimeout: 15000,
});

const frames = [
  ["Pink Classic", "pink-classic", "Nuansa pink lembut dengan aksen maroon.", "/frames/pink-classic.svg", 4, 1, 1],
  ["Maroon Elegance", "maroon-elegance", "Maroon elegan dengan aksen emas.", "/frames/maroon-elegance.svg", 4, 1, 2],
  ["Soft Bloom", "soft-bloom", "Bunga pastel untuk tiga momen favorit.", "/frames/soft-bloom.svg", 3, 1, 3],
  ["Retro Dots", "retro-dots", "Pola titik retro yang playful.", "/frames/retro-dots.svg", 3, 1, 4],
];

const filters = [
  ["Original", "original", "Tampilan natural tanpa efek.", "none", 1, 1],
  ["Soft Pink", "soft-pink", "Rona pink hangat dan lembut.", "saturate(1.1) sepia(0.12) hue-rotate(-8deg) brightness(1.04)", 1, 2],
  ["Warm Glow", "warm-glow", "Nuansa hangat seperti sinar sore.", "sepia(0.3) saturate(1.15) brightness(1.04)", 1, 3],
  ["Monochrome", "monochrome", "Hitam putih klasik dengan kontras lembut.", "grayscale(1) contrast(1.05)", 1, 4],
];

const photos = [
  ["/seed/photo-1.svg", 1],
  ["/seed/photo-2.svg", 2],
  ["/seed/photo-3.svg", 3],
  ["/seed/photo-4.svg", 4],
];

try {
  await db.beginTransaction();

  for (const frame of frames) {
    await db.query(
      `INSERT INTO frames (name, slug, description, image_url, slot_count, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description),
       image_url=VALUES(image_url), slot_count=VALUES(slot_count), is_active=VALUES(is_active), sort_order=VALUES(sort_order)`,
      frame,
    );
  }

  for (const filter of filters) {
    await db.query(
      `INSERT INTO filters (name, slug, description, css_filter, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description),
       css_filter=VALUES(css_filter), is_active=VALUES(is_active), sort_order=VALUES(sort_order)`,
      filter,
    );
  }

  const userRows = [
    ["Admin SnapBooth", process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD, "ADMIN"],
    ["Demo User", process.env.SEED_DEMO_EMAIL, process.env.SEED_DEMO_PASSWORD, "USER"],
  ];
  for (const [name, email, password, role] of userRows) {
    await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), password_hash=VALUES(password_hash), role=VALUES(role)`,
      [name, email, hashPassword(password), role],
    );
  }

  const [[demoUser]] = await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [
    process.env.SEED_DEMO_EMAIL,
  ]);
  const [[pinkFrame]] = await db.query("SELECT id FROM frames WHERE slug = 'pink-classic' LIMIT 1");
  const [[softFilter]] = await db.query("SELECT id FROM filters WHERE slug = 'soft-pink' LIMIT 1");

  const sessionCode = "11111111-1111-4111-8111-111111111111";
  await db.query(
    `INSERT INTO photo_sessions
      (session_code, user_id, frame_id, filter_id, photo_count, status, completed_at)
     VALUES (?, ?, ?, ?, 4, 'COMPLETED', CURRENT_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), frame_id=VALUES(frame_id),
      filter_id=VALUES(filter_id), status='COMPLETED', completed_at=VALUES(completed_at)`,
    [sessionCode, demoUser.id, pinkFrame.id, softFilter.id],
  );
  const [[session]] = await db.query("SELECT id FROM photo_sessions WHERE session_code = ? LIMIT 1", [
    sessionCode,
  ]);

  for (const [imageUrl, position] of photos) {
    await db.query(
      `INSERT INTO photos (session_id, position, image_url)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE image_url=VALUES(image_url)`,
      [session.id, position, imageUrl],
    );
  }

  await db.query(
    `INSERT INTO photo_strips (session_id, frame_id, filter_id, image_url, caption, is_public)
     VALUES (?, ?, ?, '/seed/strip-demo.svg', 'SnapBooth Demo', 1)
     ON DUPLICATE KEY UPDATE frame_id=VALUES(frame_id), filter_id=VALUES(filter_id),
      image_url=VALUES(image_url), caption=VALUES(caption), is_public=VALUES(is_public)`,
    [session.id, pinkFrame.id, softFilter.id],
  );

  const [[strip]] = await db.query("SELECT id FROM photo_strips WHERE session_id = ? LIMIT 1", [
    session.id,
  ]);
  const [[existingDownload]] = await db.query(
    "SELECT id FROM downloads WHERE photo_strip_id = ? AND user_id = ? LIMIT 1",
    [strip.id, demoUser.id],
  );
  if (!existingDownload) {
    await db.query("INSERT INTO downloads (photo_strip_id, user_id) VALUES (?, ?)", [
      strip.id,
      demoUser.id,
    ]);
  }

  await db.commit();

  const tableNames = ["users", "frames", "filters", "photo_sessions", "photos", "photo_strips", "downloads"];
  const counts = {};
  for (const table of tableNames) {
    const [[row]] = await db.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
    counts[table] = row.total;
  }
  console.log("Seed selesai tanpa error.");
  console.log(counts);
} catch (error) {
  await db.rollback();
  console.error("Seed gagal:", error.code || error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
