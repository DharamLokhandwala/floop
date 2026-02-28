/**
 * Applies Prisma migrations to a Turso database.
 * Run from project root: node scripts/apply-turso-migrations.mjs
 * Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env (or environment).
 */

import { createClient } from "@libsql/client";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const migrationsDir = join(rootDir, "prisma", "migrations");

function loadEnv() {
  const envPath = join(rootDir, ".env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eq = trimmed.indexOf("=");
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
          value = value.slice(1, -1);
        process.env[key] = value;
      }
    }
  }
}

function getMigrationOrder() {
  const entries = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d+_.+$/.test(d.name))
    .map((d) => d.name)
    .sort();
  return entries;
}

function splitStatements(sql) {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.replace(/^--.*$/gm, "").trim())
    .filter((s) => s.length > 0);
}

async function main() {
  loadEnv();
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    console.error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set (e.g. in .env).");
    process.exit(1);
  }

  const client = createClient({ url, authToken });
  const order = getMigrationOrder();
  console.log("Migrations to apply:", order.join(", "));
  for (const name of order) {
    const migrationPath = join(migrationsDir, name, "migration.sql");
    if (!existsSync(migrationPath)) continue;
    console.log(`\nApplying ${name}...`);
    const sql = readFileSync(migrationPath, "utf8");
    const statements = splitStatements(sql);
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.toUpperCase().startsWith("PRAGMA")) {
        console.log(`  Skip (PRAGMA not needed on Turso)`);
        continue;
      }
      try {
        await client.execute(stmt);
        console.log(`  OK`);
      } catch (err) {
        const msg = err.message || "";
        if (
          msg.includes("already exists") ||
          msg.includes("duplicate column") ||
          msg.includes("UNIQUE constraint")
        ) {
          console.log(`  Skip (already applied)`);
        } else {
          console.error(`  FAIL: ${stmt.slice(0, 80)}...`);
          console.error(msg);
          throw err;
        }
      }
    }
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
