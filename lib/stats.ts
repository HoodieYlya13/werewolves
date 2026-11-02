import { neon } from "@neondatabase/serverless";

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
  players: { sub: string; role: string; team: string; won: boolean; survived: boolean; left: boolean; daysAlive: number }[];
  /** Players with a phone who weren't signed in, each with the hash of their claim code. */
  guests: { playerId: string; codeHash: string; role: string; team: string; won: boolean; survived: boolean; left: boolean; daysAlive: number }[];
};

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
    game.players.map((p) => ({ sub: p.sub, role: p.role, team: p.team, won: p.won, survived: p.survived, left_game: p.left, days_alive: p.daysAlive })),
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
      days_alive: g.daysAlive,
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
      INSERT INTO game_players (game_id, sub, role, team, won, survived, left_game, days_alive)
      SELECT ${game.id}::uuid, sub, role, team, won, survived, left_game, days_alive
      FROM json_to_recordset(${players}::json)
        AS p(sub text, role text, team text, won boolean, survived boolean, left_game boolean, days_alive integer)`,
    // Seats that are no longer a guest's (signed in at the end) go; the others
    // are updated, keeping their code and whoever claimed them.
    sql`
      DELETE FROM guest_seats
      WHERE game_id = ${game.id} AND player_id NOT IN (SELECT value FROM json_array_elements_text(${guestIds}::json))`,
    sql`
      INSERT INTO guest_seats (game_id, player_id, code_hash, role, team, won, survived, left_game, days_alive, expires_at)
      SELECT ${game.id}::uuid, player_id, code_hash, role, team, won, survived, left_game, days_alive,
             now() + make_interval(days => ${GUEST_SEAT_DAYS})
      FROM json_to_recordset(${guests}::json)
        AS g(player_id text, code_hash text, role text, team text, won boolean, survived boolean, left_game boolean, days_alive integer)
      ON CONFLICT (game_id, player_id) DO UPDATE SET
        code_hash = EXCLUDED.code_hash, role = EXCLUDED.role, team = EXCLUDED.team, won = EXCLUDED.won,
        survived = EXCLUDED.survived, left_game = EXCLUDED.left_game, days_alive = EXCLUDED.days_alive`,
    // Claimed seats count for their account again (game_players was just rewritten).
    sql`
      INSERT INTO game_players (game_id, sub, role, team, won, survived, left_game, days_alive)
      SELECT game_id, claimed_sub, role, team, won, survived, left_game, days_alive
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
      RETURNING s.game_id, s.role, s.team, s.won, s.survived, s.left_game, s.days_alive
    )
    INSERT INTO game_players (game_id, sub, role, team, won, survived, left_game, days_alive)
    SELECT game_id, ${sub}, role, team, won, survived, left_game, days_alive FROM claimed
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

/** Everything the stats page shows for one account, in one round trip. */
export async function accountStats(url: string, sub: string): Promise<AccountStats> {
  const sql = neon(url);
  const [totals, mastered, days, teams, roles, recent] = await sql.transaction(
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
    ],
    { readOnly: true },
  );
  return {
    played: totals[0].played,
    won: totals[0].won,
    survived: totals[0].survived,
    mastered: mastered[0].mastered,
    days: days[0].counted > 0 ? (days[0] as NonNullable<AccountStats["days"]>) : null,
    teams: teams as AccountStats["teams"],
    roles: roles as AccountStats["roles"],
    recent: (recent as (Omit<AccountStats["recent"][number], "endedAt"> & { endedAt: Date | string })[]).map((r) => ({
      ...r,
      endedAt: new Date(r.endedAt).toISOString(),
    })),
  };
}
