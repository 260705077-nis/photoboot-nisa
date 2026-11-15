import mysql from "mysql2/promise";
import process from "node:process";

process.loadEnvFile(".env.local");

const url = new URL(process.env.DATABASE_URL);
const connection = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
  ssl: { rejectUnauthorized: false },
  connectTimeout: 15000,
  multipleStatements: true,
});

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(190) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_role (role)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS frames (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    description VARCHAR(255) NULL,
    image_url VARCHAR(500) NOT NULL,
    slot_count TINYINT UNSIGNED NOT NULL DEFAULT 4,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_frames_slug (slug),
    KEY idx_frames_active_sort (is_active, sort_order),
    CONSTRAINT chk_frames_slot_count CHECK (slot_count IN (3,4))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS filters (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    description VARCHAR(255) NULL,
    css_filter VARCHAR(255) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_filters_slug (slug),
    KEY idx_filters_active_sort (is_active, sort_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS photo_sessions (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    session_code CHAR(36) NOT NULL,
    user_id INT UNSIGNED NULL,
    frame_id INT UNSIGNED NULL,
    filter_id INT UNSIGNED NULL,
    photo_count TINYINT UNSIGNED NOT NULL DEFAULT 4,
    status ENUM('ACTIVE','COMPLETED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    completed_at DATETIME(3) NULL,
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_sessions_code (session_code),
    KEY idx_sessions_user_created (user_id, created_at),
    KEY idx_sessions_status_created (status, created_at),
    KEY idx_sessions_frame (frame_id),
    KEY idx_sessions_filter (filter_id),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_sessions_frame FOREIGN KEY (frame_id) REFERENCES frames (id) ON DELETE SET NULL,
    CONSTRAINT fk_sessions_filter FOREIGN KEY (filter_id) REFERENCES filters (id) ON DELETE SET NULL,
    CONSTRAINT chk_sessions_photo_count CHECK (photo_count IN (3,4))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS photos (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    session_id INT UNSIGNED NOT NULL,
    position TINYINT UNSIGNED NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_photos_session_position (session_id, position),
    KEY idx_photos_session (session_id),
    CONSTRAINT fk_photos_session FOREIGN KEY (session_id) REFERENCES photo_sessions (id) ON DELETE CASCADE,
    CONSTRAINT chk_photos_position CHECK (position IN (1,2,3,4))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS photo_strips (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    session_id INT UNSIGNED NOT NULL,
    frame_id INT UNSIGNED NULL,
    filter_id INT UNSIGNED NULL,
    image_url VARCHAR(500) NOT NULL,
    caption VARCHAR(160) NULL,
    is_public TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_strips_session (session_id),
    KEY idx_strips_public_created (is_public, created_at),
    KEY idx_strips_frame (frame_id),
    KEY idx_strips_filter (filter_id),
    CONSTRAINT fk_strips_session FOREIGN KEY (session_id) REFERENCES photo_sessions (id) ON DELETE CASCADE,
    CONSTRAINT fk_strips_frame FOREIGN KEY (frame_id) REFERENCES frames (id) ON DELETE SET NULL,
    CONSTRAINT fk_strips_filter FOREIGN KEY (filter_id) REFERENCES filters (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS downloads (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    photo_strip_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_downloads_strip (photo_strip_id),
    KEY idx_downloads_user_created (user_id, created_at),
    CONSTRAINT fk_downloads_strip FOREIGN KEY (photo_strip_id) REFERENCES photo_strips (id) ON DELETE CASCADE,
    CONSTRAINT fk_downloads_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

try {
  for (const statement of statements) {
    await connection.query(statement);
  }
  const [tables] = await connection.query("SHOW TABLES");
  console.log(`Skema siap. ${tables.length} tabel ditemukan:`);
  for (const row of tables) console.log(`- ${Object.values(row)[0]}`);
} finally {
  await connection.end();
}
