// Deploys the realtime server before the site builds, so both always match.
// On Vercel, production builds deploy the production Worker and preview builds
// deploy the staging one. Anywhere else (a local `npm run build`) it skips.
// Run with: node scripts/deploy-server.mjs
import { execFileSync } from "node:child_process";
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
  // Same OIDC client as the site, so the server accepts the tokens it hands out.
  const vars = ["AUTH_ISSUER", "AUTH_CLIENT_ID"].filter((key) => process.env[key]).flatMap((key) => ["--var", `${key}:${process.env[key]}`]);
  // The stats database (this environment's own): its schema first, then its
  // URL as a secret, so it never shows up in plain text on Cloudflare.
  const secrets = [];
  let dir;
  if (process.env.POSTGRES_URL) {
    execFileSync("node", ["scripts/db-migrate.mjs"], { stdio: "inherit" });
    dir = mkdtempSync(join(tmpdir(), "werewolves-"));
    const file = join(dir, "secrets.json");
    writeFileSync(file, JSON.stringify({ POSTGRES_URL: process.env.POSTGRES_URL }), { mode: 0o600 });
    secrets.push("--secrets-file", file);
  }
  try {
    execFileSync("npx", ["wrangler", ...args, ...vars, ...secrets], { stdio: "inherit" });
  } finally {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
}
