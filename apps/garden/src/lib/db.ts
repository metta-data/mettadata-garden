import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { DB_PATH, GARDENS_DIR } from "./paths";

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    image TEXT,
    role TEXT NOT NULL DEFAULT 'viewer',
    gardens TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login TEXT
  );
`);

// Seed initial admin if ADMIN_EMAIL is set and no admins exist
const adminEmail = process.env.ADMIN_EMAIL;
if (adminEmail) {
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(adminEmail);
  if (!existing) {
    db.prepare(
      "INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)"
    ).run(crypto.randomUUID(), adminEmail, "Admin", "admin");
  }
}

// Create gardens table
db.exec(`
  CREATE TABLE IF NOT EXISTS gardens (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT '',
    icon_type TEXT NOT NULL DEFAULT 'emoji',
    published INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed default gardens if table is empty
const gardenCount = db
  .prepare("SELECT COUNT(*) as count FROM gardens")
  .get() as { count: number };

if (gardenCount.count === 0) {
  // GARDENS_DIR imported from paths.ts

  db.prepare(
    "INSERT INTO gardens (id, name, display_name, description, icon, published, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(crypto.randomUUID(), "private", "Private", "Personal notes not visible to others", "🔒", 0, 0);

  db.prepare(
    "INSERT INTO gardens (id, name, display_name, description, icon, published, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(crypto.randomUUID(), "example", "Example", "An example garden — rename or remove it", "🌱", 1, 1);

  // Create directories for default gardens
  for (const g of ["private", "example"]) {
    fs.mkdirSync(path.join(GARDENS_DIR, g, "notes"), { recursive: true });
    fs.mkdirSync(path.join(GARDENS_DIR, g, "templates"), { recursive: true });
  }

  // Detect existing garden directories not yet in DB (migration from hardcoded setup)
  if (fs.existsSync(GARDENS_DIR)) {
    for (const entry of fs.readdirSync(GARDENS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const existing = db.prepare("SELECT id FROM gardens WHERE name = ?").get(entry.name);
      if (!existing) {
        db.prepare(
          "INSERT INTO gardens (id, name, display_name, description, icon, published, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(
          crypto.randomUUID(),
          entry.name,
          entry.name.charAt(0).toUpperCase() + entry.name.slice(1),
          "",
          "",
          1,
          99
        );
      }
    }
  }
}

// Migrate: add daily notes / calendar columns to gardens
for (const col of [
  "daily_notes_enabled INTEGER NOT NULL DEFAULT 0",
  "daily_notes_template TEXT NOT NULL DEFAULT ''",
  "daily_notes_folder TEXT NOT NULL DEFAULT 'journal'",
  "calendar_enabled INTEGER NOT NULL DEFAULT 0",
]) {
  try { db.exec(`ALTER TABLE gardens ADD COLUMN ${col}`); } catch {}
}

// Migrate: add custom_domain column to gardens
try { db.exec("ALTER TABLE gardens ADD COLUMN custom_domain TEXT NOT NULL DEFAULT ''"); } catch {}

// Create folders table
db.exec(`
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    is_global INTEGER NOT NULL DEFAULT 0,
    garden_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(name, garden_id)
  );
`);

// Migrate: add default_template to folders
try { db.exec("ALTER TABLE folders ADD COLUMN default_template TEXT NOT NULL DEFAULT ''"); } catch {}

export default db;

// Prepared statements for common operations
export const userQueries = {
  getByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),

  upsertOnLogin: db.prepare(`
    INSERT INTO users (id, email, name, image, last_login)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(email) DO UPDATE SET
      name = excluded.name,
      image = excluded.image,
      last_login = datetime('now')
  `),

  getAll: db.prepare("SELECT * FROM users ORDER BY created_at DESC"),

  updateRole: db.prepare(`
    UPDATE users SET role = ?, gardens = ? WHERE id = ?
  `),

  deleteUser: db.prepare("DELETE FROM users WHERE id = ?"),
};

export const gardenQueries = {
  getAll: db.prepare("SELECT * FROM gardens ORDER BY sort_order ASC, name ASC"),
  getPublic: db.prepare("SELECT * FROM gardens WHERE published = 1 AND name != 'private' ORDER BY sort_order ASC"),
  getByName: db.prepare("SELECT * FROM gardens WHERE name = ?"),
  getById: db.prepare("SELECT * FROM gardens WHERE id = ?"),
  getByCustomDomain: db.prepare("SELECT * FROM gardens WHERE custom_domain = ? AND published = 1"),

  create: db.prepare(`
    INSERT INTO gardens (id, name, display_name, description, icon, icon_type, published, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),

  update: db.prepare(`
    UPDATE gardens SET display_name = ?, description = ?, icon = ?, icon_type = ?, published = ?, sort_order = ?, custom_domain = ?
    WHERE id = ?
  `),

  updateName: db.prepare("UPDATE gardens SET name = ? WHERE id = ?"),

  delete: db.prepare("DELETE FROM gardens WHERE id = ? AND name != 'private'"),

  reorder: db.prepare("UPDATE gardens SET sort_order = ? WHERE id = ?"),

  updateConfig: db.prepare(`
    UPDATE gardens SET daily_notes_enabled = ?, daily_notes_template = ?, daily_notes_folder = ?, calendar_enabled = ?
    WHERE id = ?
  `),
};

export const folderQueries = {
  getAll: db.prepare("SELECT * FROM folders ORDER BY is_global DESC, name ASC"),
  getGlobal: db.prepare("SELECT * FROM folders WHERE is_global = 1 ORDER BY name ASC"),
  getForGarden: db.prepare(
    "SELECT * FROM folders WHERE is_global = 1 OR garden_id = ? ORDER BY is_global DESC, name ASC"
  ),
  getById: db.prepare("SELECT * FROM folders WHERE id = ?"),
  getByNameAndGarden: db.prepare("SELECT * FROM folders WHERE name = ? AND (garden_id = ? OR (is_global = 1 AND ? IS NULL))"),

  create: db.prepare(
    "INSERT INTO folders (id, name, display_name, icon, is_global, garden_id) VALUES (?, ?, ?, ?, ?, ?)"
  ),
  update: db.prepare("UPDATE folders SET display_name = ?, icon = ?, default_template = ? WHERE id = ?"),
  delete: db.prepare("DELETE FROM folders WHERE id = ?"),
};
