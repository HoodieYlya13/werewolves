import { neon } from "@neondatabase/serverless";
import type { Person } from "./friends";

/**
 * Finished games in Postgres (db/schema.sql). The room server writes them
 * (party/server.ts); the site reads an account's stats (app/api/stats).
 * Shared by Next and the Worker: the Neon driver talks over fetch.
 */

/** A finished game, as the room server saves it. */
export type GameResult = {
  id: string;
  room: string;
  theme: string;
  startedAt: number;
  winnerTeam: string | null;
  playerCount: number;
  /** How long the game lasted, in days (see daysBy in the engine). */
  days: number;
  masterSub: string | null;
  /** Signed-in players. */
  players: ({ sub: string; role: string; team: string; won: boolean; survived: boolean; left: boolean } & PlayerDetails)[];
  /** Who eliminated whom, between signed-in players (see killersOf in the engine). */
  kills: { killer: string; victim: string; cause: string }[];
  /** Players with a phone who weren't signed in, each with the hash of their claim code. */
  guests: ({ playerId: string; codeHash: string; role: string; team: string; won: boolean; survived: boolean; left: boolean } & PlayerDetails)[];
};

/** How a player's game went, besides winning. */
type PlayerDetails = {
  /** Days alive (see daysBy in the engine). */
  daysAlive: number;
  /** What killed them (a DeathCause), null if they survived. */
  deathCause: string | null;
  /** Elected Mayor at some point. */
  wasMayor: boolean;
  /** Made a lover by Cupid. */
  lover: boolean;
};

/** The PlayerDetails columns, as the INSERTs below read them. */
const details = (p: PlayerDetails) => ({ days_alive: p.daysAlive, death_cause: p.deathCause, was_mayor: p.wasMayor, lover: p.lover });

/** How long a guest has to sign in and claim a seat. */
export const GUEST_SEAT_DAYS = 30;

/**
 * A claim code as the database keeps it: hashed, so the table alone can't
 * claim anything. Codes are random UUIDs, so a plain SHA-256 is enough.
 */
export async function hashClaimCode(code: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Saves a game, replacing what was saved for it before (the ending was undone and replayed). */
export async function saveResult(url: string, game: GameResult) {
  const sql = neon(url);
  const players = JSON.stringify(
    game.players.map((p) => ({ sub: p.sub, role: p.role, team: p.team, won: p.won, survived: p.survived, left_game: p.left, ...details(p) })),
  );
  const guests = JSON.stringify(
    game.guests.map((g) => ({
      player_id: g.playerId,
      code_hash: g.codeHash,
      role: g.role,
      team: g.team,
      won: g.won,
      survived: g.survived,
      left_game: g.left,
      ...details(g),
    })),
  );
  const guestIds = JSON.stringify(game.guests.map((g) => g.playerId));
  await sql.transaction([
    // Housekeeping: guest seats nobody claimed in time, then games nobody is left to count.
    sql`DELETE FROM guest_seats WHERE claimed_sub IS NULL AND expires_at < now()`,
    sql`
      DELETE FROM games g
      WHERE g.master_sub IS NULL AND g.ended_at < now() - make_interval(days => ${GUEST_SEAT_DAYS})
        AND NOT EXISTS (SELECT 1 FROM game_players p WHERE p.game_id = g.id)
        AND NOT EXISTS (SELECT 1 FROM guest_seats s WHERE s.game_id = g.id)`,
    sql`
      INSERT INTO games (id, room, theme, started_at, ended_at, winner_team, player_count, master_sub, days)
      VALUES (${game.id}, ${game.room}, ${game.theme}, to_timestamp(${game.startedAt / 1000}), now(),
              ${game.winnerTeam}, ${game.playerCount}, ${game.masterSub}, ${game.days})
      ON CONFLICT (id) DO UPDATE SET
        ended_at = now(), winner_team = EXCLUDED.winner_team,
        player_count = EXCLUDED.player_count, master_sub = EXCLUDED.master_sub, days = EXCLUDED.days`,
    sql`DELETE FROM game_players WHERE game_id = ${game.id}`,
    sql`
      INSERT INTO game_players (game_id, sub, role, team, won, survived, left_game, days_alive, death_cause, was_mayor, lover)
      SELECT ${game.id}::uuid, sub, role, team, won, survived, left_game, days_alive, death_cause, was_mayor, lover
      FROM json_to_recordset(${players}::json)
        AS p(sub text, role text, team text, won boolean, survived boolean, left_game boolean,
             days_alive integer, death_cause text, was_mayor boolean, lover boolean)`,
    // Seats that are no longer a guest's (signed in at the end) go; the others
    // are updated, keeping their code and whoever claimed them.
    sql`
      DELETE FROM guest_seats
      WHERE game_id = ${game.id} AND player_id NOT IN (SELECT value FROM json_array_elements_text(${guestIds}::json))`,
    sql`
      INSERT INTO guest_seats (game_id, player_id, code_hash, role, team, won, survived, left_game,
                               days_alive, death_cause, was_mayor, lover, expires_at)
      SELECT ${game.id}::uuid, player_id, code_hash, role, team, won, survived, left_game,
             days_alive, death_cause, was_mayor, lover, now() + make_interval(days => ${GUEST_SEAT_DAYS})
      FROM json_to_recordset(${guests}::json)
        AS g(player_id text, code_hash text, role text, team text, won boolean, survived boolean, left_game boolean,
             days_alive integer, death_cause text, was_mayor boolean, lover boolean)
      ON CONFLICT (game_id, player_id) DO UPDATE SET
        code_hash = EXCLUDED.code_hash, role = EXCLUDED.role, team = EXCLUDED.team, won = EXCLUDED.won,
        survived = EXCLUDED.survived, left_game = EXCLUDED.left_game, days_alive = EXCLUDED.days_alive,
        death_cause = EXCLUDED.death_cause, was_mayor = EXCLUDED.was_mayor, lover = EXCLUDED.lover`,
    sql`DELETE FROM game_kills WHERE game_id = ${game.id}`,
    sql`
      INSERT INTO game_kills (game_id, killer_sub, victim_sub, cause)
      SELECT ${game.id}::uuid, killer, victim, cause FROM json_to_recordset(${JSON.stringify(game.kills)}::json)
        AS k(killer text, victim text, cause text)
      ON CONFLICT DO NOTHING`,
    // Claimed seats count for their account again (game_players was just rewritten).
    sql`
      INSERT INTO game_players (game_id, sub, role, team, won, survived, left_game, days_alive, death_cause, was_mayor, lover)
      SELECT game_id, claimed_sub, role, team, won, survived, left_game, days_alive, death_cause, was_mayor, lover
      FROM guest_seats WHERE game_id = ${game.id} AND claimed_sub IS NOT NULL
      ON CONFLICT DO NOTHING`,
  ]);
}

/**
 * Gives an account the guest seats whose codes it holds (at most one per
 * game), and returns how many it got. Never a game the account ran or already
 * played in, an expired seat, or one claimed before: the result always comes
 * from the room's own record, the phone only proves the seat was its own.
 */
export async function claimGuestSeats(url: string, sub: string, codes: string[]): Promise<number> {
  const hashes = JSON.stringify(await Promise.all(codes.map(hashClaimCode)));
  const rows = await neon(url)`
    WITH picked AS (
      SELECT DISTINCT ON (s.game_id) s.game_id, s.player_id
      FROM guest_seats s JOIN games g ON g.id = s.game_id
      WHERE s.code_hash IN (SELECT value FROM json_array_elements_text(${hashes}::json))
        AND s.claimed_sub IS NULL AND s.expires_at > now()
        AND g.master_sub IS DISTINCT FROM ${sub}
        AND NOT EXISTS (SELECT 1 FROM game_players p WHERE p.game_id = s.game_id AND p.sub = ${sub})
      ORDER BY s.game_id
    ), claimed AS (
      UPDATE guest_seats s SET claimed_sub = ${sub}
      FROM picked
      WHERE s.game_id = picked.game_id AND s.player_id = picked.player_id AND s.claimed_sub IS NULL
      RETURNING s.game_id, s.role, s.team, s.won, s.survived, s.left_game, s.days_alive, s.death_cause, s.was_mayor, s.lover
    )
    INSERT INTO game_players (game_id, sub, role, team, won, survived, left_game, days_alive, death_cause, was_mayor, lover)
    SELECT game_id, ${sub}, role, team, won, survived, left_game, days_alive, death_cause, was_mayor, lover FROM claimed
    ON CONFLICT DO NOTHING
    RETURNING game_id`;
  return rows.length;
}

/** Forgets a game whose ending was undone (or that no longer has anyone signed in). */
export async function deleteResult(url: string, id: string) {
  await neon(url)`DELETE FROM games WHERE id = ${id}`;
}

export type AccountStats = {
  played: number;
  won: number;
  survived: number;
  /** Games run as the game master. */
  mastered: number;
  /**
   * How long the account lives in a game, from games that recorded it (null
   * before any): mean, shortest and longest days alive; `share`, the mean of
   * days alive over the days each game lasted, so a long life in a short game
   * counts as much as in a long one; `fastestWin`, the shortest game it won.
   */
  days: { counted: number; mean: number; min: number; max: number; share: number | null; fastestWin: number | null } | null;
  teams: { team: string; played: number; won: number }[];
  /** Win rate by table size (`size`: "3-6", "7-9", "10-12" or "13+"), smallest first. */
  byPlayers: { size: string; played: number; won: number }[];
  /** Games won in a row: the ongoing run (0 after a loss) and the longest one. */
  streaks: { current: number; best: number };
  /** What killed the account, most often first (games that recorded it). */
  deaths: { cause: string; count: number }[];
  /** Games where it was elected Mayor, or made a lover by Cupid (recorded games). */
  mayor: { played: number; won: number };
  lover: { played: number; won: number };
  /** The games it ran: which side won them (null: nobody), how long and how big they were. */
  master: { meanDays: number | null; meanPlayers: number; sides: { team: string | null; count: number }[] } | null;
  /** Who it wins with most on the same side, and who eliminates it most (signed-in players, since recorded). */
  partners: (Person & { won: number; played: number })[];
  nemeses: (Person & { count: number })[];
  /** `meanDays`: mean days alive with that card (null before it was recorded). */
  roles: { role: string; played: number; won: number; meanDays: number | null }[];
  recent: {
    id: string;
    endedAt: string;
    role: string;
    team: string;
    won: boolean;
    survived: boolean;
    winnerTeam: string | null;
    playerCount: number;
    theme: string;
    /** Days alive out of the days the game lasted (null on older games). */
    daysAlive: number | null;
    days: number | null;
  }[];
};

/** Runs of wins in games played oldest first: the longest, and the one still going. */
export function streaks(results: boolean[]): AccountStats["streaks"] {
  let run = 0;
  let best = 0;
  for (const won of results) {
    run = won ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { current: run, best };
}

/** Everything the stats page shows for one account, in one round trip. */
export async function accountStats(url: string, sub: string): Promise<AccountStats> {
  const sql = neon(url);
  const [totals, mastered, days, teams, roles, recent, sizes, results, deaths, titles, master, masterSides, partners, nemeses] = await sql.transaction(
    [
      sql`SELECT count(*)::int AS played, count(*) FILTER (WHERE won)::int AS won, count(*) FILTER (WHERE survived)::int AS survived
          FROM game_players WHERE sub = ${sub}`,
      sql`SELECT count(*)::int AS mastered FROM games WHERE master_sub = ${sub}`,
      sql`SELECT count(*)::int AS counted, avg(p.days_alive)::float AS mean, min(p.days_alive) AS min, max(p.days_alive) AS max,
                 avg(p.days_alive::float / NULLIF(g.days, 0)) AS share,
                 min(g.days) FILTER (WHERE p.won) AS "fastestWin"
          FROM game_players p JOIN games g ON g.id = p.game_id
          WHERE p.sub = ${sub} AND p.days_alive IS NOT NULL AND g.days IS NOT NULL`,
      sql`SELECT team, count(*)::int AS played, count(*) FILTER (WHERE won)::int AS won
          FROM game_players WHERE sub = ${sub} GROUP BY team ORDER BY played DESC, team`,
      sql`SELECT role, count(*)::int AS played, count(*) FILTER (WHERE won)::int AS won, avg(days_alive)::float AS "meanDays"
          FROM game_players WHERE sub = ${sub} GROUP BY role ORDER BY played DESC, role`,
      sql`SELECT g.id, g.ended_at AS "endedAt", p.role, p.team, p.won, p.survived,
                 g.winner_team AS "winnerTeam", g.player_count AS "playerCount", g.theme,
                 p.days_alive AS "daysAlive", g.days
          FROM game_players p JOIN games g ON g.id = p.game_id
          WHERE p.sub = ${sub} ORDER BY g.ended_at DESC LIMIT 10`,
      sql`SELECT CASE WHEN g.player_count <= 6 THEN '3-6' WHEN g.player_count <= 9 THEN '7-9'
                      WHEN g.player_count <= 12 THEN '10-12' ELSE '13+' END AS size,
                 count(*)::int AS played, count(*) FILTER (WHERE p.won)::int AS won
          FROM game_players p JOIN games g ON g.id = p.game_id
          WHERE p.sub = ${sub} GROUP BY size ORDER BY min(g.player_count)`,
      sql`SELECT coalesce(array_agg(p.won ORDER BY g.ended_at), '{}') AS results
          FROM game_players p JOIN games g ON g.id = p.game_id WHERE p.sub = ${sub}`,
      sql`SELECT death_cause AS cause, count(*)::int AS count FROM game_players
          WHERE sub = ${sub} AND death_cause IS NOT NULL GROUP BY death_cause ORDER BY count DESC, cause`,
      sql`SELECT count(*) FILTER (WHERE was_mayor)::int AS "mayorPlayed", count(*) FILTER (WHERE was_mayor AND won)::int AS "mayorWon",
                 count(*) FILTER (WHERE lover)::int AS "loverPlayed", count(*) FILTER (WHERE lover AND won)::int AS "loverWon"
          FROM game_players WHERE sub = ${sub}`,
      sql`SELECT avg(days)::float AS "meanDays", avg(player_count)::float AS "meanPlayers" FROM games WHERE master_sub = ${sub}`,
      sql`SELECT winner_team AS team, count(*)::int AS count FROM games WHERE master_sub = ${sub}
          GROUP BY winner_team ORDER BY count DESC, team`,
      sql`SELECT a.sub, a.name, a.username, a.picture, a.friend_code AS code,
                 count(*) FILTER (WHERE me.won)::int AS won, count(*)::int AS played
          FROM game_players me JOIN game_players o ON o.game_id = me.game_id AND o.sub <> me.sub AND o.team = me.team
          JOIN accounts a ON a.sub = o.sub
          WHERE me.sub = ${sub}
          GROUP BY a.sub HAVING count(*) FILTER (WHERE me.won) > 0
          ORDER BY won DESC, played, lower(a.name) LIMIT 3`,
      sql`SELECT a.sub, a.name, a.username, a.picture, a.friend_code AS code, count(*)::int AS count
          FROM game_kills k JOIN accounts a ON a.sub = k.killer_sub
          WHERE k.victim_sub = ${sub}
          GROUP BY a.sub ORDER BY count DESC, lower(a.name) LIMIT 3`,
    ],
    { readOnly: true },
  );
  return {
    played: totals[0].played,
    won: totals[0].won,
    survived: totals[0].survived,
    mastered: mastered[0].mastered,
    days: days[0].counted > 0 ? (days[0] as NonNullable<AccountStats["days"]>) : null,
    byPlayers: sizes as AccountStats["byPlayers"],
    streaks: streaks(results[0].results as boolean[]),
    deaths: deaths as AccountStats["deaths"],
    mayor: { played: titles[0].mayorPlayed, won: titles[0].mayorWon },
    lover: { played: titles[0].loverPlayed, won: titles[0].loverWon },
    partners: partners as AccountStats["partners"],
    nemeses: nemeses as AccountStats["nemeses"],
    master: mastered[0].mastered > 0 ? { ...(master[0] as { meanDays: number | null; meanPlayers: number }), sides: masterSides as { team: string | null; count: number }[] } : null,
    teams: teams as AccountStats["teams"],
    roles: roles as AccountStats["roles"],
    recent: (recent as (Omit<AccountStats["recent"][number], "endedAt"> & { endedAt: Date | string })[]).map((r) => ({
      ...r,
      endedAt: new Date(r.endedAt).toISOString(),
    })),
  };
}

/**
 * Two accounts against each other, from `me`'s side: games played together,
 * on the same side (and won) or on opposite sides (and won), and how often
 * each eliminated the other.
 */
export type HeadToHead = {
  together: number;
  sameSide: number;
  wonTogether: number;
  opposed: number;
  wonAgainst: number;
  lostAgainst: number;
  eliminated: number;
  eliminatedBy: number;
};

export async function headToHead(url: string, me: string, other: string): Promise<HeadToHead> {
  const sql = neon(url);
  const [games, kills] = await sql.transaction(
    [
      sql`SELECT count(*)::int AS together,
                 count(*) FILTER (WHERE a.team = b.team)::int AS "sameSide",
                 count(*) FILTER (WHERE a.team = b.team AND a.won)::int AS "wonTogether",
                 count(*) FILTER (WHERE a.team <> b.team)::int AS opposed,
                 count(*) FILTER (WHERE a.team <> b.team AND a.won)::int AS "wonAgainst",
                 count(*) FILTER (WHERE a.team <> b.team AND b.won)::int AS "lostAgainst"
          FROM game_players a JOIN game_players b ON b.game_id = a.game_id AND b.sub = ${other}
          WHERE a.sub = ${me}`,
      sql`SELECT count(*) FILTER (WHERE killer_sub = ${me} AND victim_sub = ${other})::int AS eliminated,
                 count(*) FILTER (WHERE killer_sub = ${other} AND victim_sub = ${me})::int AS "eliminatedBy"
          FROM game_kills WHERE (killer_sub = ${me} AND victim_sub = ${other}) OR (killer_sub = ${other} AND victim_sub = ${me})`,
    ],
    { readOnly: true },
  );
  return { ...(games[0] as Omit<HeadToHead, "eliminated" | "eliminatedBy">), ...(kills[0] as Pick<HeadToHead, "eliminated" | "eliminatedBy">) };
}
