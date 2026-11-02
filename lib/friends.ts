import { neon } from "@neondatabase/serverless";
import type { Account } from "./account";

/**
 * Friends, invites and push subscriptions, in Postgres (db/schema.sql).
 * Shared by Next (the friends page) and the Worker (rooms add friends and
 * send invites): the Neon driver talks over fetch.
 */

/** Someone as their friends see them. */
/** `code`: their friend link, and their public profile (/players/CODE). */
export type Person = { sub: string; name: string; username: string | null; picture: string | null; code: string };

export type FriendsList = {
  /** This account's friend link code. */
  code: string | null;
  friends: Person[];
  /** Requests waiting for this account's answer, and the ones it sent. */
  incoming: Person[];
  outgoing: Person[];
};

/** What asking someone to be friends did. */
export type RequestResult = "sent" | "accepted" | "already-friends" | "already-sent" | "self" | "unknown";

/** How long an invite stays (for the notification and the invites route). */
export const INVITE_MINUTES = 120;
/** The same friend to the same room, from the same person, at most this often. */
const REINVITE_MINUTES = 5;

/** Saves the account's name, username and photo (and gives it a friend code the first time). */
export async function saveAccount(url: string, account: Account) {
  await neon(url)`
    INSERT INTO accounts (sub, name, username, picture) VALUES (${account.sub}, ${account.name}, ${account.username}, ${account.picture})
    ON CONFLICT (sub) DO UPDATE SET name = EXCLUDED.name, username = EXCLUDED.username, picture = EXCLUDED.picture, updated_at = now()`;
}

export async function friendsList(url: string, sub: string): Promise<FriendsList> {
  const sql = neon(url);
  const [me, rows] = await sql.transaction(
    [
      sql`SELECT friend_code AS code FROM accounts WHERE sub = ${sub}`,
      sql`SELECT a.sub, a.name, a.username, a.picture, a.friend_code AS code,
                 CASE WHEN f.accepted THEN 'friend' WHEN f.addressee = ${sub} THEN 'incoming' ELSE 'outgoing' END AS kind
          FROM friendships f JOIN accounts a ON a.sub = CASE WHEN f.requester = ${sub} THEN f.addressee ELSE f.requester END
          WHERE f.requester = ${sub} OR f.addressee = ${sub}
          ORDER BY lower(a.name)`,
    ],
    { readOnly: true },
  );
  const people = rows as (Person & { kind: "friend" | "incoming" | "outgoing" })[];
  const pick = (kind: string) =>
    people.filter((p) => p.kind === kind).map((p): Person => ({ sub: p.sub, name: p.name, username: p.username, picture: p.picture, code: p.code }));
  return { code: (me[0]?.code as string | undefined) ?? null, friends: pick("friend"), incoming: pick("incoming"), outgoing: pick("outgoing") };
}

/**
 * Asks `to` to be friends. If `to` already asked `from`, that request is
 * accepted instead: both want it.
 */
export async function requestFriend(url: string, from: string, to: string): Promise<RequestResult> {
  if (from === to) return "self";
  const sql = neon(url);
  const [known, existing] = await sql.transaction(
    [
      sql`SELECT count(*)::int AS n FROM accounts WHERE sub IN (${from}, ${to})`,
      sql`SELECT requester, accepted FROM friendships
          WHERE (requester = ${from} AND addressee = ${to}) OR (requester = ${to} AND addressee = ${from})`,
    ],
    { readOnly: true },
  );
  if (known[0].n < 2) return "unknown";
  const row = existing[0] as { requester: string; accepted: boolean } | undefined;
  if (row?.accepted) return "already-friends";
  if (row?.requester === from) return "already-sent";
  if (row) {
    await sql`UPDATE friendships SET accepted = true WHERE requester = ${to} AND addressee = ${from}`;
    return "accepted";
  }
  await sql`INSERT INTO friendships (requester, addressee) VALUES (${from}, ${to}) ON CONFLICT DO NOTHING`;
  return "sent";
}

/** Answers a request `other` sent: accepted, or deleted. */
export async function answerFriend(url: string, me: string, other: string, accept: boolean) {
  const sql = neon(url);
  if (accept) await sql`UPDATE friendships SET accepted = true WHERE requester = ${other} AND addressee = ${me}`;
  else await sql`DELETE FROM friendships WHERE requester = ${other} AND addressee = ${me} AND NOT accepted`;
}

/** Ends a friendship, or takes back a request, either way round. */
export async function removeFriend(url: string, me: string, other: string) {
  await neon(url)`DELETE FROM friendships
    WHERE (requester = ${me} AND addressee = ${other}) OR (requester = ${other} AND addressee = ${me})`;
}

/** Accounts whose username starts with `query` (not `me`), for adding friends. */
export async function searchAccounts(url: string, me: string, query: string): Promise<Person[]> {
  const prefix = `${query.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await neon(url)`
    SELECT sub, name, username, picture, friend_code AS code FROM accounts
    WHERE lower(username) LIKE ${prefix} AND sub <> ${me}
    ORDER BY lower(username) LIMIT 10`;
  return rows as Person[];
}

/** The account a friend link points to. */
export async function accountByCode(url: string, code: string): Promise<Person | null> {
  const rows = await neon(url)`SELECT sub, name, username, picture, friend_code AS code FROM accounts WHERE friend_code = ${code.toUpperCase()}`;
  return (rows[0] as Person | undefined) ?? null;
}

/** Of `subs`, the ones that are `sub`'s friends (accepted). */
export async function friendsAmong(url: string, sub: string, subs: string[]): Promise<string[]> {
  if (!subs.length) return [];
  const rows = await neon(url)`
    SELECT CASE WHEN requester = ${sub} THEN addressee ELSE requester END AS friend FROM friendships
    WHERE accepted AND (requester = ${sub} OR addressee = ${sub})
      AND CASE WHEN requester = ${sub} THEN addressee ELSE requester END IN (SELECT value FROM json_array_elements_text(${JSON.stringify(subs)}::json))`;
  return rows.map((r) => r.friend as string);
}

/**
 * Records invites to `room`, skipping friends this person invited there in
 * the last few minutes, and returns who was invited. Old invites go.
 */
export async function recordInvites(url: string, from: string, to: string[], room: string): Promise<string[]> {
  const sql = neon(url);
  const [, rows] = await sql.transaction([
    sql`DELETE FROM invites WHERE created_at < now() - make_interval(mins => ${INVITE_MINUTES})`,
    sql`
      INSERT INTO invites (from_sub, to_sub, room)
      SELECT ${from}, t.value, ${room} FROM json_array_elements_text(${JSON.stringify(to)}::json) t
      WHERE NOT EXISTS (
        SELECT 1 FROM invites i WHERE i.from_sub = ${from} AND i.to_sub = t.value AND i.room = ${room}
          AND i.created_at > now() - make_interval(mins => ${REINVITE_MINUTES}))
      RETURNING to_sub`,
  ]);
  return rows.map((r) => r.to_sub as string);
}

export type Invite = { room: string; from: Person; at: string };

/** This account's recent invites, newest first. */
export async function recentInvites(url: string, sub: string): Promise<Invite[]> {
  const rows = await neon(url)`
    SELECT i.room, i.created_at AS at, a.sub, a.name, a.username, a.picture, a.friend_code AS code
    FROM invites i JOIN accounts a ON a.sub = i.from_sub
    WHERE i.to_sub = ${sub} AND i.created_at > now() - make_interval(mins => ${INVITE_MINUTES})
    ORDER BY i.created_at DESC LIMIT 5`;
  return rows.map((r) => ({
    room: r.room as string,
    at: new Date(r.at as string).toISOString(),
    from: { sub: r.sub as string, name: r.name as string, username: r.username as string | null, picture: r.picture as string | null, code: r.code as string },
  }));
}

export async function savePushSubscription(url: string, sub: string, endpoint: string) {
  await neon(url)`INSERT INTO push_subscriptions (endpoint, sub) VALUES (${endpoint}, ${sub})
    ON CONFLICT (endpoint) DO UPDATE SET sub = EXCLUDED.sub`;
}

export async function deletePushSubscription(url: string, endpoint: string) {
  await neon(url)`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
}

/** Where to send a push for each of these accounts. */
export async function pushEndpoints(url: string, subs: string[]): Promise<{ sub: string; endpoint: string }[]> {
  if (!subs.length) return [];
  const rows = await neon(url)`SELECT sub, endpoint FROM push_subscriptions
    WHERE sub IN (SELECT value FROM json_array_elements_text(${JSON.stringify(subs)}::json))`;
  return rows as { sub: string; endpoint: string }[];
}
