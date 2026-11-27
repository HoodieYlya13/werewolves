import { teamOf, daysBy, killersOf } from "../../lib/engine";
import { deleteResult, hashClaimCode, saveResult, type GameResult } from "../../lib/stats";
import type { PlayerView } from "../../lib/protocol";
import { STORAGE_KEY, type StoredGame } from "./state";
import { broadcastViews } from "./views";
import type { RoomServer } from "../server";

/**
 * Keeps the stats database in step with the game: saved once it has a
 * winner, rewritten if the ending is undone and replayed, deleted if it's
 * undone for good. Runs after every change; most of them write nothing.
 */
export function recordResult(room: RoomServer) {
  const url = room.bindings.POSTGRES_URL;
  if (!url) return;
  room.recording = room.recording
    .then(() => writeResult(room, url))
    .catch((error) => console.error("Saving the game's result failed:", error));
  room.waitUntil(room.recording);
}

export async function writeResult(room: RoomServer, url: string) {
  const stored = room.state?.game;
  if (!stored || !room.game) return;
  stored.id ??= crypto.randomUUID();
  const result = room.game.winner ? await resultOf(room, stored) : null;
  // A game with nobody signed in and no guest phone has no one's stats to count.
  const worth = result && (result.players.length > 0 || result.guests.length > 0 || result.masterSub || result.organiserSub);
  const signature = worth ? JSON.stringify(result) : "";
  if (signature === (stored.recorded ?? "")) return;
  if (worth) await saveResult(url, result);
  else await deleteResult(url, stored.id);
  stored.recorded = signature;
  if (room.state) await room.storage.put(STORAGE_KEY, room.state);
  // Guest phones get their claim code now that it can be claimed.
  if (result?.guests.length) broadcastViews(room);
}

/** A guest seat's claim code once the game's result is saved, for that seat's phone only. */
export function claimFor(room: RoomServer, playerId: string): PlayerView["claim"] {
  const stored = room.state?.game;
  const seat = room.state?.players.find((p) => p.id === playerId);
  const code = stored?.claims?.[playerId];
  if (!room.game?.winner || !stored?.recorded || !stored.id || !code || !seat || seat.sub || seat.manual) return null;
  return { gameId: stored.id, code };
}

export async function resultOf(room: RoomServer, stored: StoredGame): Promise<GameResult> {
  const s = room.state!;
  const game = room.game!;
  const winners = new Set(game.winner!.playerIds);
  // Without a game master the creator plays, and nobody mastered the game. A
  // game master counts only if they ran it to the end; whoever started it organised it.
  const masterSub = stored.auto || stored.masterChanged ? null : (stored.organiser ?? s.hostSub ?? null);
  const organiserSub = stored.organiser ?? (stored.masterChanged ? null : (s.hostSub ?? null));
  // A seat's account, as counted in the stats (the master's own account never plays).
  const subOf = (id: string) => {
    const sub = seats.find((x) => x.id === id)?.sub;
    return sub && sub !== masterSub ? sub : null;
  };
  const days = daysBy(stored.setup, game.phase);
  const details = (p: (typeof game.players)[number]) => ({
    daysAlive: p.death ? daysBy(stored.setup, p.death.phase) : days,
    deathCause: p.death?.cause ?? null,
    wasMayor: game.events.some((e) => e.type === "mayor" && e.playerId === p.id),
    lover: !!game.lovers?.includes(p.id),
  });
  const seats = [...s.players, ...(s.formerPlayers ?? [])];
  const players = new Map<string, GameResult["players"][number]>();
  for (const p of game.players) {
    const seat = seats.find((x) => x.id === p.id);
    if (!seat?.sub || seat.sub === masterSub) continue;
    players.set(seat.sub, { sub: seat.sub, role: p.role, team: teamOf(game, p), won: winners.has(p.id), survived: p.alive, left: !!seat.left, ...details(p) });
  }
  // Phones without an account: the seat waits for its phone to sign in and claim it.
  const guests: GameResult["guests"] = [];
  for (const p of game.players) {
    const seat = s.players.find((x) => x.id === p.id);
    if (!seat || seat.sub || seat.manual || seat.left) continue;
    const code = ((stored.claims ??= {})[p.id] ??= crypto.randomUUID());
    guests.push({
      playerId: p.id,
      codeHash: await hashClaimCode(code),
      role: p.role,
      team: teamOf(game, p),
      won: winners.has(p.id),
      survived: p.alive,
      left: false,
      ...details(p),
    });
  }
  return {
    id: stored.id!,
    room: s.code,
    theme: stored.setup.settings.theme,
    startedAt: stored.startedAt ?? Date.now(),
    winnerTeam: game.winner!.team,
    playerCount: game.players.length,
    days,
    masterSub,
    organiserSub,
    auto: !!stored.auto,
    players: [...players.values()],
    guests,
    kills: game.players.flatMap((victim) => {
      const victimSub = subOf(victim.id);
      return victimSub && victim.death
        ? killersOf(game, victim).flatMap((id) => {
            const killer = subOf(id);
            return killer && killer !== victimSub ? [{ killer, victim: victimSub, cause: victim.death!.cause }] : [];
          })
        : [];
    }),
  };
}
