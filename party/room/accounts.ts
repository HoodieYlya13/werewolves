import { getServerByName } from "partyserver";
import { Account } from "../../lib/account";
import { verifyTicket } from "../../lib/ticket";
import { workerTicketKey } from "../keys";
import { saveAccount } from "../../lib/friends";
import type { ErrorCode } from "../../lib/protocol";
import { type StoredPlayer, PHOTO_PREFIX, type ConnState, type Conn } from "./state";
import { claimAccountName, renamePlayer } from "./names";
import { viewFor } from "./views";
import type { RoomServer } from "../server";

/** Checks an ID token from the auth server. Accounts are off when no client id is set. */
/** The account a page's ticket stands for (lib/ticket.ts). Each ticket works once, in this autoGame only. */
export async function verifyAccount(room: RoomServer, conn: Conn, token: unknown): Promise<Account | null> {
  const ticket = await verifyTicket(await workerTicketKey(room.bindings), token, { room: room.name });
  const now = Date.now() / 1000;
  for (const [jti, exp] of room.usedTickets) if (exp < now) room.usedTickets.delete(jti);
  if (!ticket || room.usedTickets.has(ticket.jti)) {
    room.send(conn, { type: "error", code: "invalid-account" });
    return null;
  }
  room.usedTickets.set(ticket.jti, ticket.exp);
  const account = { sub: ticket.sub, name: ticket.name, picture: ticket.picture, username: ticket.username };
  // Friends find and see accounts by what their sign-in says.
  const url = room.bindings.POSTGRES_URL;
  if (url) room.waitUntil(saveAccount(url, account).catch((error) => console.error("Saving the account failed:", error)));
  return account;
}

/**
 * A device opens the autoGame as its game master with a ticket from the
 * master's account (after "Run it from here" on that device). It gets a new
 * master key; any other master screen stops.
 */
export async function takeHost(room: RoomServer, conn: Conn, ticket: string) {
  const account = await verifyAccount(room, conn, ticket);
  const s = room.state;
  if (!account || !s || s.hostSub !== account.sub) return room.reject(conn, "not-host");
  s.hostToken = crypto.randomUUID();
  closeHosts(room, "host-moved", conn);
  conn.setState({ kind: "host" });
  await room.persist();
  room.send(conn, { type: "host-token", token: s.hostToken });
  room.send(conn, { type: "view", view: viewFor(room, conn) });
}

/** Ends every master connection but `except`. */
export function closeHosts(room: RoomServer, code: ErrorCode, except?: Conn) {
  for (const c of room.getConnections<ConnState>()) {
    if (c.state?.kind === "host" && c.id !== except?.id) room.reject(c, code);
  }
}

/** A guest's seat becomes an account's: its name and photo from now on. */
export async function linkSeat(room: RoomServer, player: StoredPlayer, account: Account) {
  player.sub = account.sub;
  // The account's photo replaces the one set in the autoGame.
  player.photo = null;
  await room.storage.delete(PHOTO_PREFIX + player.id);
  applyAccount(room, player, account);
  await tellAccount(room, account.sub, true);
}

/** The game master's account changed: seats waiting for it get linked now. */
export async function completePendingLinks(room: RoomServer) {
  for (const conn of room.getConnections<ConnState>()) {
    const state = conn.state;
    if (state?.kind !== "player" || !state.pendingLink) continue;
    const account = state.pendingLink;
    if (account.sub === room.state!.hostSub) continue;
    conn.setState({ kind: "player", playerId: state.playerId });
    const player = room.state!.players.find((p) => p.id === state.playerId);
    if (player && !player.sub && !findAccount(room, account.sub)) await linkSeat(room, player, account);
  }
}

/** A player (current or former) signed in with this account. */
export function findAccount(room: RoomServer, sub: string) {
  return [...room.state!.players, ...(room.state!.formerPlayers ?? [])].find((p) => p.sub === sub);
}

/** Keeps a player's name and photo in step with their account. */
export function applyAccount(room: RoomServer, player: StoredPlayer, account: Account) {
  player.picture = account.picture;
  player.accountName = account.name;
  player.username = account.username;
  const name = claimAccountName(room, { ...player, accountName: account.name }, player.id);
  if (name !== player.name) renamePlayer(room, player, name);
}

/** Tells an account's server whether it has a seat in this autoGame (see party/account.ts). */
export async function tellAccount(room: RoomServer, sub: string | undefined, seated: boolean) {
  if (!sub) return;
  try {
    const account = await getServerByName(room.bindings.Account, sub);
    await (seated ? account.addRoom(room.name) : account.removeRoom(room.name));
  } catch {
    // Only used to warn a new device; the autoGame works without it.
  }
}

/**
 * One autoGame at a time per account: joining here while seated in another
 * autoGame asks first (`other-room`), then leaves it once confirmed with
 * `leaveOther`. Returns false when it asked.
 */
export async function checkOtherRoom(room: RoomServer, conn: Conn, sub: string, leaveOther: boolean | undefined) {
  try {
    const account = await getServerByName(room.bindings.Account, sub);
    if (leaveOther) {
      await account.releaseOtherRooms(room.name);
      return true;
    }
    const other = await account.otherSeat(room.name);
    if (!other) return true;
    room.send(conn, { type: "other-room", room: other.room, inGame: other.inGame });
    return false;
  } catch {
    // The account's server is unreachable: don't block the game over it.
    return true;
  }
}

/** The autoGame is going away: its accounts no longer have a seat here. */
export async function releaseAccounts(room: RoomServer) {
  for (const p of room.state?.players ?? []) await tellAccount(room, p.sub, false);
  await tellAccount(room, room.state?.hostSub, false);
}

/** The autoGame's master account follows the seat that leads (or runs) it. */
export function adoptAccount(room: RoomServer, seat: StoredPlayer) {
  const s = room.state!;
  if (seat.sub) {
    s.hostSub = seat.sub;
    s.hostFace = { name: seat.accountName ?? seat.name, picture: seat.picture ?? null, username: seat.username ?? null };
  } else {
    delete s.hostSub;
    delete s.hostFace;
  }
}
