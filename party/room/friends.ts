import { getServerByName } from "partyserver";
import { friendsAmong, profilePeek, recordInvites, requestFriend } from "../../lib/friends";
import { sendPushes } from "../push";
import type { FriendFace } from "../../lib/protocol";
import { FRIEND_CALLS_PER_MINUTE, MAX_INVITES, INVITE_MS, type Conn } from "./state";
import { findAccount } from "./accounts";
import type { RoomServer } from "../server";

/** The account behind a connection: the master's, or the seat's. */
export function accountOf(room: RoomServer, conn: Conn, isHost: boolean): { sub: string; face: FriendFace } | null {
  const s = room.state!;
  if (isHost) return s.hostSub ? { sub: s.hostSub, face: s.hostFace ?? { name: "", picture: null } } : null;
  const seat = conn.state?.kind === "player" ? s.players.find((p) => p.id === (conn.state as { playerId: string }).playerId) : null;
  return seat?.sub ? { sub: seat.sub, face: { name: seat.accountName ?? seat.name, picture: seat.picture ?? null } } : null;
}

export function tooManyFriendCalls(room: RoomServer, conn: Conn) {
  return tooManyCalls(room, room.friendCalls, conn, FRIEND_CALLS_PER_MINUTE);
}

export function tooManyCalls(room: RoomServer, calls: Map<string, number[]>, conn: Conn, max: number) {
  const now = Date.now();
  const recent = (calls.get(conn.id) ?? []).filter((t) => now - t < 60_000);
  calls.set(conn.id, [...recent, now]);
  return recent.length >= max;
}

/** Asks another signed-in seat, or the game master (null), to be friends. Account ids never reach the phones. */
export async function addFriend(room: RoomServer, conn: Conn, isHost: boolean, playerId: string | null) {
  const url = room.bindings.POSTGRES_URL;
  const me = accountOf(room, conn, isHost);
  if (!url || !me || tooManyFriendCalls(room, conn)) return;
  const s = room.state!;
  const target = playerId === null ? s.hostSub : [...s.players, ...(s.formerPlayers ?? [])].find((p) => p.id === playerId)?.sub;
  let result: Awaited<ReturnType<typeof requestFriend>> = "unknown";
  try {
    if (target) result = await requestFriend(url, me.sub, target);
  } catch (error) {
    console.error("Adding a friend failed:", error);
  }
  room.send(conn, { type: "friend-result", result });
  if (target && (result === "sent" || result === "accepted")) {
    try {
      await (await getServerByName(room.bindings.Account, target)).friendRequest(me.face, result === "accepted");
    } catch {}
  }
}

/** Which accounts in the autoGame are already this one's friends, as seats: their "add friend" buttons say so instead. */
export async function friendsHere(room: RoomServer, conn: Conn, isHost: boolean) {
  const url = room.bindings.POSTGRES_URL;
  const me = accountOf(room, conn, isHost);
  if (!url || !me || tooManyFriendCalls(room, conn)) return;
  const s = room.state!;
  const seats = s.players.filter((p) => p.sub && p.sub !== me.sub);
  const subs = [...seats.map((p) => p.sub!), ...(s.hostSub && s.hostSub !== me.sub ? [s.hostSub] : [])];
  try {
    const friends = new Set(await friendsAmong(url, me.sub, subs));
    room.send(conn, {
      type: "friends-here",
      playerIds: seats.filter((p) => friends.has(p.sub!)).map((p) => p.id),
      host: !!s.hostSub && friends.has(s.hostSub),
    });
  } catch (error) {
    console.error("Looking up friends failed:", error);
  }
}

/** A signed-in seat's profile in brief (or the game master's: null), for anyone in the autoGame; account ids stay here. */
export async function profile(room: RoomServer, conn: Conn, isHost: boolean, playerId: string | null) {
  const url = room.bindings.POSTGRES_URL;
  if (!url || tooManyCalls(room, room.profileCalls, conn, 2 * FRIEND_CALLS_PER_MINUTE)) return;
  const s = room.state!;
  const sub = playerId === null ? s.hostSub : [...s.players, ...(s.formerPlayers ?? [])].find((p) => p.id === playerId)?.sub;
  let profile = null;
  try {
    if (sub) profile = await profilePeek(url, accountOf(room, conn, isHost)?.sub ?? null, sub);
  } catch (error) {
    console.error("Looking up a profile failed:", error);
  }
  room.send(conn, { type: "profile", playerId, profile });
}

/** Invites friends to this room: on their open pages, and by push where they turned it on. */
export async function invite(room: RoomServer, conn: Conn, isHost: boolean, subs: string[]) {
  const url = room.bindings.POSTGRES_URL;
  const me = accountOf(room, conn, isHost);
  if (!url || !me || tooManyFriendCalls(room, conn)) return;
  const s = room.state!;
  const wanted = [...new Set(subs)]
    .slice(0, MAX_INVITES)
    // Already here (playing or running it): nothing to invite to.
    .filter((sub) => sub !== s.hostSub && !findAccount(room, sub));
  let invited: string[] = [];
  try {
    const friends = await friendsAmong(url, me.sub, wanted);
    if (friends.length) {
      invited = await recordInvites(url, me.sub, friends, room.name);
      await rememberInvited(room, friends);
    }
  } catch (error) {
    console.error("Inviting friends failed:", error);
  }
  room.send(conn, { type: "invited", count: invited.length });
  for (const sub of invited) {
    try {
      await (await getServerByName(room.bindings.Account, sub)).invite(room.name, me.face);
    } catch {}
  }
  room.waitUntil(sendPushes(room.bindings, url, invited).catch((error) => console.error("Sending invites failed:", error)));
}

export async function rememberInvited(room: RoomServer, subs: string[]) {
  const now = Date.now();
  const stillValid = Object.entries(room.state!.invitedAt ?? {}).filter(([, at]) => now - at < INVITE_MS);
  room.state!.invitedAt = Object.fromEntries([...stillValid, ...subs.map((sub) => [sub, now] as const)]);
  await room.persist();
}

export function isInvited(room: RoomServer, sub: string): boolean {
  const at = room.state?.invitedAt?.[sub];
  return at !== undefined && Date.now() - at < INVITE_MS;
}
