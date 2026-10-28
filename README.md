# Werewolves · Loups-Garous

A game master's companion for Werewolves (Les Loups-Garous de Thiercelieux) and other hidden-role games. The game master runs the game on a big screen; players join with their phones to see their role.

- Role and theme research: [docs/roles-and-themes.md](docs/roles-and-themes.md)

## Stack

- Next.js 16 with Cache Components (PPR), Partial Prefetching and the React Compiler
- Tailwind CSS 4
- PartyServer on Cloudflare Durable Objects for realtime rooms (`party/server.ts`, `wrangler.jsonc`)
- English by default, French at `/fr` (`lib/i18n`)
- Light / dark / auto theme with no flash (`lib/theme.ts`)
- Installable PWA (`app/manifest.ts`, `public/icons`)

## Develop

```bash
npm install
npm run dev
```

This starts Next.js on port 3000 and the room server (`wrangler dev`) on port 1999.

**Testing with phones:** open the app on the game master's device using your computer's LAN IP (for example `http://192.168.1.200:3000`), not `localhost`. The QR code uses that address, and phones connect to the room server on the same host.

## Deploy the room server

The hosted PartyKit platform shut down in October 2026, so rooms run on your own Cloudflare account (the free plan is enough to start).

```bash
npx wrangler login
npm run party:deploy
```

Then set `NEXT_PUBLIC_PARTYKIT_HOST` to the printed `*.workers.dev` host (see `.env.example`).

After that, Vercel keeps the server in step with the site: `npm run build` runs `scripts/deploy-server.mjs` first, which deploys the production server on production builds and the staging server (`npm run party:deploy:staging`) on preview builds. A local `npm run build` skips it. For this to work, add to the Vercel project:

- `CLOUDFLARE_API_TOKEN`: an API token made from the "Edit Cloudflare Workers" template
- `CLOUDFLARE_ACCOUNT_ID`: from `npx wrangler whoami`
- `NEXT_PUBLIC_PARTYKIT_HOST`: the production host for Production, the staging host for Preview

## Accounts

Players can sign in with the [hy13 auth server](https://auth.hy13dev.com) (OpenID Connect). Their first name and profile photo come from the account, and nobody else can take that name: a player without an account who uses it is renamed ("Ylya 2") and can pick another. Players without an account can rename themselves at any time; the game master can't rename account players.

The site does the sign-in (Authorization Code with PKCE and the client secret, in `app/api/auth`) and keeps both tokens in httpOnly cookies scoped to `/api/auth`: the page's JavaScript never sees them. To prove the account to the room server, which runs on another domain, a page asks `/api/auth/ticket` for a ticket (`lib/ticket.ts`): signed by the site, valid for one minute, for one room (or the account server), usable once, and carrying only the account's id, first name and photo.

Register a confidential client on the auth server with the redirect URI `<site>/api/auth/callback` and the post-logout URI `<site>/api/auth/logged-out` (scopes `openid profile offline_access`), then set `AUTH_CLIENT_ID` and `AUTH_CLIENT_SECRET` in `.env.local` and in Vercel. The build gives the room server a ticket key derived from the client secret (never the secret itself). Leave them unset (for example on Preview, whose URLs change) and the sign-in button is hidden.

Every server deploy restarts the rooms: connected players reconnect on their own after a moment and keep their game.

## Stats

Finished games are saved to Postgres (Neon) for signed-in players and game masters: their card, side, whether they won and whether they survived (`db/schema.sql`). Guests aren't saved. The room server writes a game as soon as it has a winner and rewrites or deletes it if the game master undoes the ending (`lib/stats.ts`). The stats page (`/[lang]/stats`, "My stats" in the account menu) shows the win rate, survival, games run as game master, and use and win rate per side and per card.

Each environment has its own database in `POSTGRES_URL` (Vercel's Neon integration sets it). Vercel builds create the tables (`scripts/db-migrate.mjs`, safe to rerun) and hand the URL to the room server as a Worker secret. Locally, `npm run db:migrate` applies the schema to the database in `.env.local`, and `wrangler dev` reads the URL from there too.

## How rooms work

- The game master's browser creates a 4-letter room code and a secret token, saved in `localStorage`.
- Phones join with a name (or their account) and get a player id and token, also saved in `localStorage`. A refresh, a locked screen or a closed tab puts them back in the same seat.
- The server sends each connection its own view: the game master sees everything, a phone only sees public info and its own data.
- Each room is a Durable Object. It hibernates between messages, saves its state to storage, and is wiped 24 hours after everyone leaves.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js + room server (`wrangler dev`) |
| `npm run build` | Deploy the server (on Vercel only), then build the site |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run party:deploy` | Deploy the room server to Cloudflare (`werewolves.<subdomain>.workers.dev`) |
| `npm run party:deploy:staging` | Deploy a separate staging room server (`werewolves-staging…`) |
| `npm run party:types` | Regenerate the Worker types after changing `wrangler.jsonc` |
| `npm run db:migrate` | Create or update the stats tables in the database from `.env.local` |
| `node scripts/generate-icons.mjs` | Regenerate PNG icons from `public/icons/icon.svg` |
