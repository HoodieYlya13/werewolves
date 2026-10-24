# Werewolves · Loups-Garous

A game master's companion for Werewolves (Les Loups-Garous de Thiercelieux) and other hidden-role games. The game master runs the game on a big screen; players join with their phones to see their role.

- Role and theme research: [docs/roles-and-themes.md](docs/roles-and-themes.md)

## Stack

- Next.js 16 with Cache Components (PPR), Partial Prefetching and the React Compiler
- Tailwind CSS 4
- PartyKit for realtime rooms (`party/server.ts`)
- English by default, French at `/fr` (`lib/i18n`)
- Light / dark / auto theme with no flash (`lib/theme.ts`)
- Installable PWA (`app/manifest.ts`, `public/icons`)

## Develop

```bash
npm install
npm run dev
```

This starts Next.js on port 3000 and PartyKit on port 1999.

**Testing with phones:** open the app on the game master's device using your computer's LAN IP (for example `http://192.168.1.200:3000`), not `localhost`. The QR code uses that address, and phones connect to PartyKit on the same host.

## How rooms work

- The game master's browser creates a 4-letter room code and a secret token, saved in `localStorage`.
- Phones join with a name and get a player id and token, also saved in `localStorage`. A refresh, a locked screen or a closed tab puts them back in the same seat.
- The server sends each connection its own view: the game master sees everything, a phone only sees public info and its own data.
- Room state is saved to PartyKit storage and wiped 24 hours after everyone leaves.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js + PartyKit dev servers |
| `npm run build` | Production build |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run party:deploy` | Deploy the PartyKit server |
| `node scripts/generate-icons.mjs` | Regenerate PNG icons from `public/icons/icon.svg` |
