// Deploys the realtime server before the site builds, so both always match.
// On Vercel, production builds deploy the production Worker and preview builds
// deploy the staging one. Anywhere else (a local `npm run build`) it skips.
// Run with: node scripts/deploy-server.mjs
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const targets = {
  production: ["deploy"],
  preview: ["deploy", "--env", "staging"],
};

const env = process.env.VERCEL_ENV;
const args = targets[env];

if (!args) {
  console.log(`Not a Vercel production or preview build (VERCEL_ENV=${env ?? "unset"}): skipping the server deploy.`);
} else {
  console.log(`Deploying the ${env === "preview" ? "staging" : "production"} server...`);
  // Secrets, so they never show up in plain text on Cloudflare:
  // - TICKET_KEY checks the site's tickets (lib/ticket.ts). It's derived from
  //   the OIDC client secret the same way the site derives it, so the Worker
  //   never holds the client secret itself.
  // - POSTGRES_URL is this environment's stats database, migrated first.
  const secrets = {};
  if (process.env.AUTH_CLIENT_ID && process.env.AUTH_CLIENT_SECRET) {
    secrets.TICKET_KEY = createHmac("sha256", process.env.AUTH_CLIENT_SECRET).update("werewolves-ticket-v1").digest("base64url");
  }
  if (process.env.POSTGRES_URL) {
    execFileSync("node", ["scripts/db-migrate.mjs"], { stdio: "inherit" });
    secrets.POSTGRES_URL = process.env.POSTGRES_URL;
  }
  const flags = [];
  let dir;
  if (Object.keys(secrets).length > 0) {
    dir = mkdtempSync(join(tmpdir(), "werewolves-"));
    const file = join(dir, "secrets.json");
    writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 });
    flags.push("--secrets-file", file);
  }
  try {
    execFileSync("npx", ["wrangler", ...args, ...flags], { stdio: "inherit" });
  } finally {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
}
