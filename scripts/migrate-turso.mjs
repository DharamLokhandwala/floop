/**
 * Run Prisma migrations against Turso. Use when DATABASE_URL is not set to Turso
 * (Prisma CLI requires file: for SQLite). Loads TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from .env.
 * Usage: node scripts/migrate-turso.mjs
 */
import { createClient } from "@libsql/client";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const migrationsDir = join(root, "prisma", "migrations");

// Load .env so TURSO_* are available when run as node script
try {
  const envPath = join(root, ".env");
  const env = readFileSync(envPath, "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {
  // .env optional if env already set
}

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;
if (!tursoUrl || !tursoToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (e.g. in .env)");
  process.exit(1);
}

const client = createClient({ url: tursoUrl, authToken: tursoToken });

// Prisma's migrations table (minimal schema Prisma expects)
const createMigrationsTable = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "checksum" TEXT NOT NULL,
  "finished_at" DATETIME,
  "migration_name" TEXT NOT NULL,
  "logs" TEXT,
  "rolled_back_at" DATETIME,
  "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);
`;

function getMigrationDirs() {
  const names = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();
  return names;
}

async function getAppliedMigrations() {
  const r = await client.execute("SELECT migration_name FROM _prisma_migrations");
  return new Set(r.rows.map((row) => row.migration_name));
}

/** Detect which migrations are already reflected in the DB (e.g. tables/columns exist). */
async function detectAppliedMigrations() {
  const applied = new Set();
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  );
  const tableSet = new Set(tables.rows.map((r) => r.name));

  const hasAudit = tableSet.has("Audit");
  const hasUser = tableSet.has("User");
  const hasAccount = tableSet.has("Account");
  const hasAuditShare = tableSet.has("AuditShare");

  let auditCols = [];
  let auditShareCols = [];
  if (hasAudit) {
    const c = await client.execute("PRAGMA table_info('Audit')");
    auditCols = c.rows.map((r) => r.name);
  }
  if (hasAuditShare) {
    const c = await client.execute("PRAGMA table_info('AuditShare')");
    auditShareCols = c.rows.map((r) => r.name);
  }

  if (hasAudit && auditCols.includes("url")) applied.add("20260219194953_init");
  if (hasAudit && auditCols.includes("userPinsJson")) applied.add("20260219204716_add_user_pins");
  if (hasAudit && auditCols.includes("archived")) applied.add("20260228185329_add_archived");
  if (hasUser) applied.add("20260228194449_add_user");
  if (hasAccount) applied.add("20260228202720_add_nextauth_models");
  if (hasAuditShare) applied.add("20260301171757_add_audit_ownership_and_sharing");
  if (auditShareCols.includes("lastSeenUserPinsCount")) applied.add("20260302120000_add_last_seen_user_pins_count");
  if (auditCols.includes("mode")) applied.add("20260305003717_add_audit_mode");
  if (auditCols.includes("reviewerName") && auditCols.includes("ownerLastSeenUserPinsCount")) applied.add("20260306000000_add_reviewer_and_owner_last_seen");

  return applied;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function runMigration(name) {
  const sqlPath = join(migrationsDir, name, "migration.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    if (!stmt) continue;
    await client.execute(stmt + ";");
  }
  const id = generateId();
  const startedAt = new Date().toISOString();
  await client.execute({
    sql: `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, "", startedAt, name, null, null, startedAt, statements.length],
  });
  console.log("  Applied:", name);
}

async function baselineMigration(name) {
  const id = generateId();
  const startedAt = new Date().toISOString();
  await client.execute({
    sql: `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, "", startedAt, name, "baselined", null, startedAt, 0],
  });
  console.log("  Baselined:", name);
}

async function main() {
  console.log("Ensuring _prisma_migrations table...");
  await client.execute(createMigrationsTable);

  const inTable = await getAppliedMigrations();
  const detected = await detectAppliedMigrations();
  for (const name of detected) {
    if (!inTable.has(name)) {
      await baselineMigration(name);
      inTable.add(name);
    }
  }

  const all = getMigrationDirs();
  const pending = all.filter((name) => !inTable.has(name));

  if (pending.length === 0) {
    console.log("All migrations already applied.");
    return;
  }
  console.log(`Running ${pending.length} migration(s)...`);
  for (const name of pending) {
    await runMigration(name);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
