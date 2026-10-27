// Applies db/schema.sql to the database in POSTGRES_URL. Safe to rerun.
// Locally: node --env-file=.env.local scripts/db-migrate.mjs (npm run db:migrate)
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.POSTGRES_URL;
if (!url) {
  console.log("POSTGRES_URL is not set: skipping the database migration.");
} else {
  const sql = neon(url);
  const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
  const statements = schema
    .replace(/--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) await sql.query(statement);
  console.log(`Database schema up to date (${statements.length} statements).`);
}
