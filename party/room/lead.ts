import type { PlayerView } from "../../lib/protocol";
import { MASTER_GRACE_MS, type ConnState, type Conn } from "./state";
import { dropSeat, hostSeat } from "./seats";
import { verifyAccount, tellAccount, adoptAccount } from "./accounts";
import { autoRoom, resumeAuto } from "./auto-runner";
import type { RoomServer } from "../server";

/**
 * A device whose master key moved on while it was gone: a leader who comes
 * back before the new one decided takes the lead back; otherwise they play
 * their seat again, or (a game master) watch the game.
 */
export async function welcomeBack(room: RoomServer, conn: Conn, token: string) {
  const s = room.state!;
  const seatId = s.formerHosts![token];
  delete s.formerHosts![token];
  const seat = seatId ? s.players.find((p) => p.id === seatId) : null;
  const lost = s.lostLeader;
  if (seat && lost && lost.seatId === seat.id && !lost.settled && s.paused === "leader" && autoRoom(room)) {
    // Back in time: the lead goes back to them, and the phone that held it plays again.
    const interim = hostSeat(room);
    for (const c of [...room.getConnections<ConnState>()].filter((c) => c.state?.kind === "host")) {
      if (!interim) continue;
      interim.token = crypto.randomUUID();
      room.send(c, { type: "become", as: "player", id: interim.id, token: interim.token });
      c.setState({ kind: "player", playerId: interim.id });
    }
    s.hostToken = crypto.randomUUID();
    s.hostSeatId = seat.id;
    adoptAccount(room, seat);
    seat.connected = true;
    s.lostLeader = null;
    s.leaderLostAt = null;
    conn.setState({ kind: "host" });
    room.send(conn, { type: "host-token", token: s.hostToken });
    resumeAuto(room);
  } else if (seat) {
    seat.token = crypto.randomUUID();
    room.send(conn, { type: "become", as: "player", id: seat.id, token: seat.token });
  } else if (s.game) {
    const watcher = { id: crypto.randomUUID(), token: crypto.randomUUID() };
    s.spectators = [...(s.spectators ?? []), watcher];
    if (s.awayMaster && !s.awayMaster.spectatorId) s.awayMaster.spectatorId = watcher.id;
    room.send(conn, { type: "become", as: "player", id: watcher.id, token: watcher.token });
  } else {
    room.send(conn, { type: "become", as: "guest" });
  }
  await room.done();
}

/** What a watching device may do to take the game back (see reclaimMaster). */
export function masterAwayFor(room: RoomServer, state: ConnState | null | undefined): PlayerView["masterAway"] {
  const s = room.state!;
  const away = s.awayMaster;
  if (!away || !room.game || room.game.winner || state?.kind !== "guest") return null;
  const byDevice = !!state.spectator && state.deviceId === away.spectatorId;
  const byAccount = !!away.sub;
  if (!byDevice && !byAccount) return null;
  const runner = s.players.find((p) => p.id === s.masterSeatId)?.name ?? "";
  return { byDevice, byAccount, runner };
}

/**
 * The game master whose screen went away runs the game again: the dead
 * player who took over plays their seat again.
 */
export async function reclaimMaster(room: RoomServer, conn: Conn, ticket: string | undefined) {
  const s = room.state!;
  const away = s.awayMaster;
  const state = conn.state;
  if (!away || !room.game || room.game.winner) return room.send(conn, { type: "error", code: "invalid-action" });
  const isSameDevice = state?.kind === "guest" && !!state.spectator && state.deviceId === away.spectatorId;
  if (!isSameDevice) {
    const account = ticket ? await verifyAccount(room, conn, ticket) : null;
    if (!account || account.sub !== away.sub) return room.send(conn, { type: "error", code: "not-host" });
  }
  const interim = s.players.find((p) => p.id === s.masterSeatId);
  const interimSub = s.hostSub;
  for (const c of [...room.getConnections<ConnState>()].filter((c) => c.state?.kind === "host")) {
    if (!interim) {
      room.reject(c, "host-moved");
      continue;
    }
    interim.token = crypto.randomUUID();
    room.send(c, { type: "become", as: "player", id: interim.id, token: interim.token });
    c.setState({ kind: "player", playerId: interim.id });
  }
  s.masterSeatId = null;
  s.hostToken = crypto.randomUUID();
  if (away.sub) s.hostSub = away.sub;
  else delete s.hostSub;
  if (away.face) s.hostFace = away.face;
  else delete s.hostFace;
  s.spectators = s.spectators?.filter((x) => x.id !== away.spectatorId);
  s.awayMaster = null;
  s.masterLostAt = null;
  s.masterGone = false;
  room.send(conn, { type: "become", as: "host", token: s.hostToken });
  if (interimSub && interimSub !== s.hostSub) await tellAccount(room, interimSub, true);
  if (s.hostSub) await tellAccount(room, s.hostSub, true);
  await room.done();
}

/**
 * With a game master: their screen gone for a minute, a dead player whose
 * phone is here takes the game over. Nobody dead: phones may leave.
 */
export async function checkMaster(room: RoomServer) {
  const s = room.state!;
  const game = room.game;
  if (!s.masterLostAt || s.auto || !game || game.winner) return;
  if (Date.now() - s.masterLostAt < MASTER_GRACE_MS) return;
  const online = new Set(
    [...room.getConnections<ConnState>()].flatMap((c) => (c.state?.kind === "player" ? [c.state.playerId] : [])),
  );
  const dead = [...s.players]
    .sort((a, b) => a.seat - b.seat)
    .find((p) => online.has(p.id) && !p.manual && !game.players.find((g) => g.id === p.id)?.alive);
  if (dead && (await transferLead(room, dead.id, true))) {
    s.masterLostAt = null;
    s.masterGone = false;
  } else {
    s.masterGone = true;
  }
}

/** The phone asked about a leader who's gone: the next one connected around the table. */
export function successorId(room: RoomServer): string | null {
  const s = room.state!;
  const leader = hostSeat(room);
  const online = new Set(
    [...room.getConnections<ConnState>()].flatMap((c) => (c.state?.kind === "player" ? [c.state.playerId] : [])),
  );
  const seats = [...s.players].sort((a, b) => a.seat - b.seat);
  const from = leader ? seats.findIndex((p) => p.id === leader.id) : -1;
  for (let i = 1; i <= seats.length; i++) {
    const p = seats[(from + i + seats.length) % seats.length];
    if (p.id !== leader?.id && online.has(p.id)) return p.id;
  }
  return null;
}

/**
 * The autoGame goes to a player's device: it gets the master key and opens the
 * game master's screen. The device that had it plays its seat again
 * (without a game master), watches the game (a game master mid-game), or
 * is a visitor who may ask to join (a game master in the lobby). Without
 * a game master, anyone may lead; with one, during a game, only the dead.
 * `away`: the leader's device is gone (it's told nothing).
 */
export async function transferLead(room: RoomServer, targetId: string, away = false): Promise<boolean> {
  const s = room.state!;
  const target = s.players.find((p) => p.id === targetId && !p.left && !p.manual);
  const conns = [...room.getConnections<ConnState>()];
  const phones = conns.filter((c) => c.state?.kind === "player" && c.state.playerId === targetId);
  const autoMode = s.mode === "auto";
  const game = s.game ? room.game : null;
  if (!target || phones.length === 0 || target.id === s.hostSeatId) return false;
  if (game && !autoMode && game.players.find((p) => p.id === targetId)?.alive) return false;

  const oldSub = s.hostSub;
  const oldSeat = hostSeat(room);
  if (away && game && !autoMode) s.awayMaster = { sub: oldSub ?? null, face: s.hostFace ?? null, spectatorId: null };
  // A device that's gone keeps its key in mind: it gets its part back when it returns (welcomeBack).
  if (away) s.formerHosts = { ...s.formerHosts, [s.hostToken]: autoMode ? (oldSeat?.id ?? null) : null };
  s.hostToken = crypto.randomUUID();
  for (const c of conns.filter((c) => c.state?.kind === "host")) {
    if (away) continue;
    if (autoMode && oldSeat) {
      // Back to playing their own seat, from the phone page.
      oldSeat.token = crypto.randomUUID();
      room.send(c, { type: "become", as: "player", id: oldSeat.id, token: oldSeat.token });
      c.setState({ kind: "player", playerId: oldSeat.id });
    } else if (game) {
      const watcher = { id: crypto.randomUUID(), token: crypto.randomUUID() };
      s.spectators = [...(s.spectators ?? []), watcher];
      room.send(c, { type: "become", as: "player", id: watcher.id, token: watcher.token });
      c.setState({ kind: "guest", deviceId: watcher.id, token: watcher.token, spectator: true });
    } else {
      room.send(c, { type: "become", as: "guest" });
      c.setState({ kind: "guest" });
    }
  }
  if (autoMode && oldSeat && away) oldSeat.token = null;
  if (oldSeat) oldSeat.connected = conns.some((c) => c.state?.kind === "player" && c.state.playerId === oldSeat.id);

  adoptAccount(room, target);
  if (autoMode) s.hostSeatId = target.id;
  else if (game) s.masterSeatId = target.id;
  // A game master doesn't play: their seat goes.
  else await dropSeat(room, target.id);
  if (game && !autoMode && s.game) s.game.masterChanged = true;
  for (const phone of phones) room.send(phone, { type: "become", as: "host", token: s.hostToken });

  if (oldSub && oldSub !== s.hostSub) await tellAccount(room, oldSub, autoMode && !!oldSeat);
  if (s.hostSub) await tellAccount(room, s.hostSub, true);
  s.leaderLostAt = null;
  return true;
}
