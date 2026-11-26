import { neon } from "@neondatabase/serverless";

/**
 * Deletes what this app kept about accounts deleted on the auth server: their
 * profile and friendships, invites, notifications and stats. Games they
 * played stay, without them; games they ran or started keep no trace of who.
 */
export async function purgeAccounts(url: string, subs: string[]): Promise<void> {
  if (subs.length === 0) return;
  const sql = neon(url);
  await sql.transaction([
    sql`DELETE FROM push_subscriptions WHERE sub = ANY(${subs})`,
    sql`DELETE FROM invites WHERE from_sub = ANY(${subs}) OR to_sub = ANY(${subs})`,
    sql`DELETE FROM game_kills WHERE killer_sub = ANY(${subs}) OR victim_sub = ANY(${subs})`,
    sql`DELETE FROM game_players WHERE sub = ANY(${subs})`,
    // A claimed guest seat: its stats moved to game_players, the seat itself only remembers who.
    sql`DELETE FROM guest_seats WHERE claimed_sub = ANY(${subs})`,
    sql`UPDATE games SET master_sub = NULL WHERE master_sub = ANY(${subs})`,
    sql`UPDATE games SET organiser_sub = NULL WHERE organiser_sub = ANY(${subs})`,
    // Friendships go with it (ON DELETE CASCADE).
    sql`DELETE FROM accounts WHERE sub = ANY(${subs})`,
  ]);
}
