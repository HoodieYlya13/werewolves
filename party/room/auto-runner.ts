import { applyAction } from "../../lib/engine";
import * as auto from "../../lib/auto";
import { themeDictionary } from "../../lib/themes";
import en from "../../lib/i18n/dictionaries/en";
import fr from "../../lib/i18n/dictionaries/fr";
import { LEADER_GRACE_MS, SPEAKER_GRACE_MS, type ConnState, secureRandom } from "./state";
import { hostSeat } from "./seats";
import { checkMaster, successorId, transferLead } from "./lead";
import type { RoomServer } from "../server";

/** The game as lib/auto.ts plays it; null with a game master. Changes go back with `keepAuto`. */
export function autoRoom(room: RoomServer): auto.AutoRoom | null {
  const s = room.state;
  if (!s?.auto || !s.game || !room.game) return null;
  return { game: room.game, log: s.game.log, auto: s.auto, ballot: s.ballot ?? null, timer: s.timer ?? null, candidates: s.candidates ?? [] };
}

export function keepAuto(room: RoomServer, autoGame: auto.AutoRoom) {
  room.game = autoGame.game;
  room.state!.ballot = autoGame.ballot;
  room.state!.timer = autoGame.timer;
}

export async function runAuto(room: RoomServer) {
  if (!autoRoom(room)) return checkMaster(room);
  checkLeader(room);
  const autoGame = autoRoom(room)!;
  auto.tick(autoGame, autoContext(room));
  keepAuto(room, autoGame);
  // Between two lines now, perhaps: the pause it was waiting for.
  await checkLeader(room);
}

/**
 * The leader's device away for a while: the game pauses (between two lines,
 * never mid-sentence) and the lead moves to the next phone around the
 * table, which decides: wait for them, their sudden death, or resume.
 */
export async function checkLeader(room: RoomServer) {
  const s = room.state!;
  const autoGame = autoRoom(room);
  const now = Date.now();
  if (!autoGame) return;
  if (hostSeat(room)?.connected) {
    s.leaderLostAt = null;
    return;
  }
  s.leaderLostAt ??= now;
  if (autoGame.game.winner || now - s.leaderLostAt < LEADER_GRACE_MS) return;
  if (s.paused !== "leader") {
    if (!s.paused && autoGame.auto.phase === "say") return;
    auto.pause(autoGame, now);
    s.paused = "leader";
    keepAuto(room, autoGame);
  }
  const next = successorId(room);
  const leader = hostSeat(room);
  if (!next || !leader) return;
  s.lostLeader = { seatId: leader.id, name: leader.name };
  await transferLead(room, next, true);
}

/** Starts a paused game again; at night, everyone closes their eyes first. */
export function resumeAuto(room: RoomServer) {
  const autoGame = autoRoom(room);
  const s = room.state!;
  if (!autoGame) return;
  const night = autoGame.game.phase.kind === "night" && autoGame.game.step.kind !== "prologue";
  auto.resume(autoGame, Date.now(), night ? narration(room).auto.everyoneSleep : undefined);
  s.paused = null;
  keepAuto(room, autoGame);
}

/**
 * Players may run for Mayor during the election only: with a game master,
 * while it's on; without one, while the narrator asks who stands.
 */
export function mayorRaceOpen(room: RoomServer) {
  const game = room.game;
  if (!game || game.winner || game.step.kind !== "mayor-election") return false;
  const autoGame = autoRoom(room);
  return !autoGame || !!auto.autoPublic(autoGame, null, narration(room)).candidacy;
}

/** A player out for good, without a game master: the autoGame announces it and goes on. */
export function suddenDeath(room: RoomServer, playerId: string) {
  const autoGame = autoRoom(room);
  if (!autoGame) return;
  try {
    autoGame.game = applyAction(autoGame.game, { type: "sudden-death", playerId });
  } catch {
    return;
  }
  autoGame.log.push({ type: "sudden-death", playerId });
  autoGame.ballot = null;
  autoGame.timer = null;
  // The step starts over after the announcement: no pause left hanging over it.
  autoGame.auto.pausedAt = null;
  room.state!.paused = null;
  keepAuto(room, autoGame);
}

/** The narrator's words, in the autoGame's language and the game's theme. */
export function narration(room: RoomServer) {
  const locale = room.state?.locale ?? "en";
  return themeDictionary(locale === "fr" ? fr : en, room.game?.setup.settings.theme, locale);
}

export function autoContext(room: RoomServer): auto.AutoContext {
  return { dict: narration(room), random: secureRandom, now: Date.now() };
}

/** The device that reads the game out loud: the creator's, or else the first phone connected. */
export function speakerId(room: RoomServer): string | null {
  if (!room.state?.auto || !room.game) return null;
  const conns = [...room.getConnections<ConnState>()];
  const host = conns.find((c) => c.state?.kind === "host");
  if (host) return host.id;
  const lostAt = room.state.leaderLostAt;
  if (lostAt && Date.now() - lostAt < SPEAKER_GRACE_MS) return null;
  const seats = new Map(room.state.players.map((p) => [p.id, p.seat]));
  const phones = conns.filter((c) => c.state?.kind === "player").sort((a, b) => (seats.get((a.state as { playerId: string }).playerId) ?? 0) - (seats.get((b.state as { playerId: string }).playerId) ?? 0));
  return phones[0]?.id ?? null;
}
