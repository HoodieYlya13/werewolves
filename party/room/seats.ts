import { MAX_PLAYERS, MAX_REQUESTS, MAX_PHOTO_LENGTH } from "../../lib/protocol";
import { type StoredPlayer, type StoredRequest, PHOTO_PREFIX, type ConnState, type Conn } from "./state";
import { validateName, isNameFree, uniqueName, claimAccountName, renamePlayer } from "./names";
import { linkSeat, findAccount, tellAccount } from "./accounts";
import type { RoomServer } from "../server";

export function addPlayer(room: RoomServer, name: string, manual: boolean, device?: { id: string; token: string }) {
  const player: StoredPlayer = {
    id: device?.id ?? crypto.randomUUID(),
    token: manual ? null : (device?.token ?? crypto.randomUUID()),
    name,
    seat: room.state!.players.length,
    connected: !manual,
    manual,
    photo: null,
    left: false,
  };
  room.state!.players.push(player);
  return player;
}

/** Saves a photo sent as a data URL. Returns false when it isn't a valid, small image. */
export async function storePhoto(room: RoomServer, player: StoredPlayer, data: unknown) {
  const valid =
    typeof data === "string" &&
    data.length <= MAX_PHOTO_LENGTH &&
    /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(data);
  if (!valid) return false;
  await room.storage.put(PHOTO_PREFIX + player.id, data);
  player.photo = Date.now();
  return true;
}

/** A former player takes their seat again (and their name, unless it was taken meanwhile). */
export async function bringBack(room: RoomServer, playerId: string, requestedName: string) {
  const s = room.state!;
  let player = s.players.find((p) => p.id === playerId);
  if (player) {
    player.left = false;
  } else {
    const former = s.formerPlayers?.find((p) => p.id === playerId);
    if (!former) return;
    s.formerPlayers = s.formerPlayers!.filter((p) => p.id !== former.id);
    player = { ...former, left: false };
    // Back in their seat. Mid-game they sit out until the next one, at the end of the table.
    if (s.game) s.players.push(player);
    else s.players.splice(Math.min(former.seat, s.players.length), 0, player);
    reseat(room);
    s.endedGame = null;
  }
  // The name may have been taken while they were away.
  const name = player.sub
    ? claimAccountName(room, { ...player, accountName: player.accountName ?? requestedName }, player.id)
    : isNameFree(room, requestedName, player.id)
      ? requestedName
      : uniqueName(room, requestedName, player.id);
  if (player.name !== name) renamePlayer(room, player, name);
  await tellAccount(room, player.sub, true);
  for (const c of room.getConnections<ConnState>()) {
    if (c.state?.kind === "returning" && c.state.playerId === player.id) {
      c.setState({ kind: "player", playerId: player.id });
      player.connected = true;
    }
  }
}

/** A player leaves: mid-game they stay in it for the game master to play; in the lobby they're remembered. */
export function leaveSeat(room: RoomServer, player: StoredPlayer) {
  const s = room.state!;
  for (const c of room.getConnections<ConnState>()) {
    if (c.state?.kind === "player" && c.state.playerId === player.id) c.setState({ kind: "returning", playerId: player.id });
  }
  player.connected = false;
  if (s.game) {
    // The game needs everyone it was dealt with: the game master plays their part (until it ends).
    player.left = true;
  } else {
    s.endedGame = null;
    rememberFormerPlayer(room, player);
  }
}

/** Out of the lobby, remembered (photo included) so they can ask to come back. */
export function rememberFormerPlayer(room: RoomServer, player: StoredPlayer) {
  const s = room.state!;
  s.players = s.players.filter((p) => p.id !== player.id);
  s.formerPlayers = [...(s.formerPlayers ?? []).filter((p) => p.id !== player.id), player];
  reseat(room);
}

/**
 * The game master's answer to a new phone (see JoinRequest): a seat of its
 * own, not during a game, or `seatId`, a seat without an account, which
 * moves to this phone (lost cookies, another browser, a friend taking over).
 */
export async function answerNewPhone(room: RoomServer, host: Conn, request: StoredRequest, allow: boolean, seatId: string | undefined) {
  const s = room.state!;
  const seat = seatId === undefined ? null : s.players.find((p) => p.id === seatId);
  if (allow && (seat ? seat.sub : seatId !== undefined || s.game)) return;
  const account = request.signedIn;
  // That account found its own way in meanwhile, or runs the autoGame.
  if (allow && account && (findAccount(room, account.sub) || account.sub === s.hostSub)) {
    return room.send(host, { type: "error", code: "account-in-use" });
  }
  if (allow && !seat && isFull(room, host)) return;
  s.requests = s.requests!.filter((r) => r.id !== request.id);
  if (!allow) {
    s.deniedIds = [...(s.deniedIds ?? []), request.id];
    return;
  }
  const phones = [...room.getConnections<ConnState>()].filter((c) => c.state?.kind === "guest" && c.state.deviceId === request.id);
  let player: StoredPlayer;
  if (seat) {
    player = seat;
    const before = { ...seat };
    const kicked: string[] = [];
    // Whoever had this seat loses it, their request to come back too.
    for (const c of room.getConnections<ConnState>()) {
      const state = c.state;
      if ((state?.kind === "player" || state?.kind === "returning" || state?.kind === "locked") && state.playerId === seat.id) {
        room.send(c, { type: "error", code: "seat-given" });
        c.setState({ kind: "guest" });
        kicked.push(c.id);
      }
    }
    s.requests = s.requests.filter((r) => r.id !== seat.id);
    seat.token = request.token ?? crypto.randomUUID();
    seat.deviceId = request.id;
    seat.manual = false;
    seat.left = false;
    // The seat takes the new player's name (an account's comes with linking it).
    if (account) await linkSeat(room, seat, account);
    else renamePlayer(room, seat, isNameFree(room, request.name, seat.id) ? request.name : uniqueName(room, request.name, seat.id));
    s.handover = { before, request, kicked };
  } else {
    const name = account
      ? claimAccountName(room, { accountName: account.name, username: account.username, showUsername: request.showUsername })
      : isNameFree(room, request.name)
        ? request.name
        : uniqueName(room, request.name);
    const taken = [...s.players, ...(s.formerPlayers ?? [])].some((p) => p.id === request.id);
    player = addPlayer(room, name, false, request.token && !taken ? { id: request.id, token: request.token } : undefined);
    s.endedGame = null;
    if (account) {
      player.sub = account.sub;
      player.picture = account.picture;
      player.accountName = account.name;
      player.username = account.username;
      player.showUsername = request.showUsername;
      await tellAccount(room, account.sub, true);
    }
  }
  player.connected = phones.length > 0;
  for (const phone of phones) {
    phone.setState({ kind: "player", playerId: player.id });
    room.send(phone, { type: "joined", playerId: player.id, token: player.token! });
  }
}

/** A misclicked handover: the seat goes back to who had it, the new phone back to waiting. */
export async function undoHandover(room: RoomServer) {
  const s = room.state!;
  const handover = s.handover;
  s.handover = null;
  const index = s.players.findIndex((p) => p.id === handover?.before.id);
  if (!handover || index === -1) return;
  const { before, request, kicked } = handover;
  const seat = s.players[index];
  for (const c of room.getConnections<ConnState>()) {
    if (c.state?.kind === "player" && c.state.playerId === seat.id) {
      c.setState({ kind: "guest", deviceId: request.id, token: request.token });
    }
  }
  if (seat.sub && seat.sub !== before.sub) await tellAccount(room, seat.sub, false);
  const restored: StoredPlayer = { ...before, seat: seat.seat, connected: false };
  s.players[index] = restored;
  renamePlayer(room, restored, before.name);
  s.requests = [...(s.requests ?? []).filter((r) => r.id !== request.id), request];
  // The phone that lost the seat gets it back, if it's still here.
  for (const c of room.getConnections<ConnState>()) {
    const state = c.state;
    if (state?.kind !== "guest" || !(kicked.includes(c.id) || state.deviceId === before.id || (!!before.deviceId && state.deviceId === before.deviceId))) continue;
    c.setState({ kind: before.left ? "returning" : "player", playerId: before.id });
    if (before.token) room.send(c, { type: "joined", playerId: before.id, token: before.token });
    restored.connected = !before.left;
  }
}

export function reseat(room: RoomServer) {
  room.state!.players.forEach((p, i) => (p.seat = i));
}

/** True (with an error) when the autoGame has no seat left. */
export function isFull(room: RoomServer, conn: Conn) {
  if (room.state!.players.length < MAX_PLAYERS) return false;
  room.send(conn, { type: "error", code: "room-full" });
  return true;
}

/** True (with an error) when too many phones already wait, `id` aside. */
export function tooManyRequests(room: RoomServer, conn: Conn, id: string) {
  const others = (room.state!.requests ?? []).filter((r) => r.id !== id);
  if (others.length < MAX_REQUESTS) return false;
  room.send(conn, { type: "error", code: "room-full" });
  return true;
}

/** The creator's seat, without a game master. */
export function hostSeat(room: RoomServer) {
  const id = room.state?.hostSeatId;
  return id ? (room.state!.players.find((p) => p.id === id) ?? null) : null;
}

/** The seat a connection plays: a phone's, or the creator's without a game master. */
export function seatOf(room: RoomServer, conn: Conn): string | null {
  if (conn.state?.kind === "player") return conn.state.playerId;
  if (conn.state?.kind === "host") return hostSeat(room)?.id ?? null;
  return null;
}

/** The creator takes a seat: their account's name, or the one they typed. */
export function addHostSeat(room: RoomServer, conn: Conn, name: unknown) {
  const s = room.state!;
  const face = s.hostSub ? s.hostFace : undefined;
  const seatName = face ? claimAccountName(room, { accountName: face.name, username: face.username ?? null }) : validateName(room, conn, name);
  if (!seatName || isFull(room, conn)) return false;
  const seat = addPlayer(room, seatName, false);
  seat.token = null;
  s.hostSeatId = seat.id;
  // Seated first: the creator usually starts the circle.
  s.players = [seat, ...s.players.filter((p) => p !== seat)];
  reseat(room);
  syncHostSeat(room);
  return true;
}

export async function removeHostSeat(room: RoomServer) {
  const s = room.state!;
  const id = s.hostSeatId;
  if (!id) return;
  s.players = s.players.filter((p) => p.id !== id);
  s.hostSeatId = null;
  await room.storage.delete(PHOTO_PREFIX + id);
  reseat(room);
}

/** The creator's seat follows the account they're signed in with. */
export function syncHostSeat(room: RoomServer) {
  const s = room.state!;
  const seat = hostSeat(room);
  if (!seat) return;
  seat.connected = [...room.getConnections<ConnState>()].some((c) => c.state?.kind === "host");
  if (!s.hostSub || !s.hostFace) {
    delete seat.sub;
    seat.picture = null;
    return;
  }
  seat.sub = s.hostSub;
  seat.picture = s.hostFace.picture;
  seat.accountName = s.hostFace.name;
  seat.username = s.hostFace.username ?? null;
  const name = claimAccountName(room, { ...seat, accountName: s.hostFace.name }, seat.id);
  if (name !== seat.name) renamePlayer(room, seat, name);
}

/** Removes a seat from the autoGame (and tells its phone). */
export async function dropSeat(room: RoomServer, playerId: string, tell = false) {
  const s = room.state!;
  await tellAccount(room, s.players.find((p) => p.id === playerId)?.sub, false);
  s.players = s.players.filter((p) => p.id !== playerId);
  s.requests = s.requests?.filter((r) => r.id !== playerId);
  await room.storage.delete(PHOTO_PREFIX + playerId);
  reseat(room);
  for (const c of room.getConnections<ConnState>()) {
    if ((c.state?.kind === "player" || c.state?.kind === "returning") && c.state.playerId === playerId) {
      if (tell) room.send(c, { type: "error", code: "removed" });
      c.setState({ kind: "guest" });
    }
  }
}
