import { neon } from "@neondatabase/serverless";

/**
 * Finished games in Postgres (db/schema.sql). The room server writes them
 * (party/server.ts); the site reads an account's stats (app/api/stats).
 * Shared by Next and the Worker: the Neon driver talks over fetch.
 */

/** A finished game, as the room server saves it. Only signed-in players are listed. */
export type GameResult = {
  id: string;
  room: string;
  theme: string;
  startedAt: number;
  winnerTeam: string | null;
  playerCount: number;
  masterSub: string | null;
  players: { sub: string; role: string; team: string; won: boolean; survived: boolean; left: boolean }[];
};

/** Saves a game, replacing what was saved for it before (the ending was undone and replayed). */
export async function saveResult(url: string, game: GameResult) {
  const sql = neon(url);
  const players = JSON.stringify(
    game.players.map((p) => ({ sub: p.sub, role: p.role, team: p.team, won: p.won, survived: p.survived, left_game: p.left })),
  );
  await sql.transaction([
    sql`
      INSERT INTO games (id, room, theme, started_at, ended_at, winner_team, player_count, master_sub)
      VALUES (${game.id}, ${game.room}, ${game.theme}, to_timestamp(${game.startedAt / 1000}), now(),
              ${game.winnerTeam}, ${game.playerCount}, ${game.masterSub})
      ON CONFLICT (id) DO UPDATE SET
        ended_at = now(), winner_team = EXCLUDED.winner_team,
        player_count = EXCLUDED.player_count, master_sub = EXCLUDED.master_sub`,
    sql`DELETE FROM game_players WHERE game_id = ${game.id}`,
    sql`
      INSERT INTO game_players (game_id, sub, role, team, won, survived, left_game)
      SELECT ${game.id}::uuid, sub, role, team, won, survived, left_game
      FROM json_to_recordset(${players}::json)
        AS p(sub text, role text, team text, won boolean, survived boolean, left_game boolean)`,
  ]);
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
  teams: { team: string; played: number; won: number }[];
  roles: { role: string; played: number; won: number }[];
  recent: { id: string; endedAt: string; role: string; team: string; won: boolean; survived: boolean; winnerTeam: string | null; playerCount: number; theme: string }[];
};

/** Everything the stats page shows for one account, in one round trip. */
export async function accountStats(url: string, sub: string): Promise<AccountStats> {
  const sql = neon(url);
  const [totals, mastered, teams, roles, recent] = await sql.transaction(
    [
      sql`SELECT count(*)::int AS played, count(*) FILTER (WHERE won)::int AS won, count(*) FILTER (WHERE survived)::int AS survived
          FROM game_players WHERE sub = ${sub}`,
      sql`SELECT count(*)::int AS mastered FROM games WHERE master_sub = ${sub}`,
      sql`SELECT team, count(*)::int AS played, count(*) FILTER (WHERE won)::int AS won
          FROM game_players WHERE sub = ${sub} GROUP BY team ORDER BY played DESC, team`,
      sql`SELECT role, count(*)::int AS played, count(*) FILTER (WHERE won)::int AS won
          FROM game_players WHERE sub = ${sub} GROUP BY role ORDER BY played DESC, role`,
      sql`SELECT g.id, g.ended_at AS "endedAt", p.role, p.team, p.won, p.survived,
                 g.winner_team AS "winnerTeam", g.player_count AS "playerCount", g.theme
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
    teams: teams as AccountStats["teams"],
    roles: roles as AccountStats["roles"],
    recent: (recent as (Omit<AccountStats["recent"][number], "endedAt"> & { endedAt: Date | string })[]).map((r) => ({
      ...r,
      endedAt: new Date(r.endedAt).toISOString(),
    })),
  };
}
