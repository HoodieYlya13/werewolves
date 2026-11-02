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

Register a confidential client on the auth server with the redirect URI `<site>/api/auth/callback` and the post-logout URI `<site>/api/auth/logged-out` (scopes `openid public_profile offline_access`), then set `AUTH_CLIENT_ID` and `AUTH_CLIENT_SECRET` in `.env.local` and in Vercel. The build gives the room server a ticket key derived from the client secret (never the secret itself). Leave them unset (for example on Preview, whose URLs change) and the sign-in button is hidden.

Every server deploy restarts the rooms: connected players reconnect on their own after a moment and keep their game.

## Stats

Finished games are saved to Postgres (Neon) for signed-in players and game masters: their card, side, whether they won and whether they survived (`db/schema.sql`). Guests with a phone are saved too, waiting to be claimed: the room sends each guest seat's phone a claim code (only its hash is stored, in `guest_seats`), the phone keeps it (`lib/guest-games.ts`), and once it signs in it sends the codes to `/api/auth/claim`, which adds those seats to the account's stats. The result always comes from the room's record, never from the phone; a code works once, never for a game the account ran or already played in, and expires after 30 days. The home page offers signed-out players with games waiting to sign in and keep them. The room server writes a game as soon as it has a winner and rewrites or deletes it if the game master undoes the ending (`lib/stats.ts`). The stats page (`/[lang]/stats`, "My stats" in the account menu) shows the win rate, survival, games run as game master, and use and win rate per side and per card. It also counts days alive (each vote or dawn starts a day; the Angel's opening day 0 counts): the mean, the shortest and longest, the share of each game survived (days alive out of the days the game lasted, so a short game counts as much as a long one), the fastest win, and the mean days alive per card. Games saved before days were recorded are left out of those. Also: winning streaks (current and best), win rate as Mayor and as a lover, win rate by number of players, what killed the player, and for game masters which side won the games they ran with their average size and length.

Each environment has its own database in `POSTGRES_URL` (Vercel's Neon integration sets it). Vercel builds create the tables (`scripts/db-migrate.mjs`, safe to rerun) and hand the URL to the room server as a Worker secret. Locally, `npm run db:migrate` applies the schema to the database in `.env.local`, and `wrangler dev` reads the URL from there too.

## Profiles

Every player who signed in has a public profile at `/[lang]/players/CODE` (the same code as their friend link), open to anyone, kept out of search engines: their stats, worded about them. Signed in, it adds the head to head: games together, the win rate on the same side and against each other, and who eliminated whom. Every stats page also lists the best partners (most wins together on the same side) and who eliminates the player most. Who eliminated whom is worked out when a game is saved (`killersOf` in the engine): the pack that night for a wolves' kill, the Witch for poison, the Hunter, the White Werewolf, the Knight; votes, the Scapegoat and grief have no one to blame. It's kept between signed-in players only (`game_kills`).

## Friends

Signed-in players can become friends, in the same database as the stats (`db/schema.sql`, `lib/friends.ts`). A request needs the other person to accept. Three ways to ask: the "add friend" button next to signed-in players (and the game master) in a room, which goes through the room server so account ids never reach other phones; a personal friend link (`/friends/add/CODE`); or a search by username. The Friends page (`/[lang]/friends`, in the account menu) lists friends and requests.

The game master and signed-in players in the lobby can invite friends. The room checks they're friends, records the invite, and tells each friend's account server (`party/account.ts`), so every page they have open shows a card to join. Devices that turned notifications on also get a push, sent by the room server (`party/push.ts`). The push is empty: the service worker (`public/sw.js`) asks `/api/auth/invites` for the newest invite and shows it. On iPhone and iPad, notifications only work from the installed app.

To turn push on: `node scripts/generate-vapid-keys.mjs`, then add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` to Vercel (production and preview) and `.env.local`. Without them, invites still show in the app.

## Sound

The game master's screen plays a soundtrack (`lib/sound.ts`): music composed live with the Web Audio API for the day, the night, the vote and each night role, a hit and a bell for each death, an alarm when the debate timer runs out, and a tune for the winners. Phones stay silent. A few recordings, all from Wikimedia Commons, converted to `.m4a` in `public/sounds`:

- `wolf-howl.m4a`, the wolves in the Werewolves theme: "Wolf howls.ogg", U.S. Fish and Wildlife Service, public domain.
- Each theme's dawn:
  - `rooster.m4a` (Werewolves): "Medium rooster crowing.ogg" by alys, public domain.
  - `car-horn.m4a` (Mafia): "Car Horn.wav" by 15HPanska_Ruttner_Jan, CC0.
  - `dawn-bell.m4a` (Vampires): "25822 heigh-hoo peace-bell-hiroshima.wav" by Heigh-hoo, CC0.
  - `ship-klaxon.m4a` (Spaceship): "WWII submarine dive klaxon.ogg", U.S. Navy, public domain.

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
