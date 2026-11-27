import { replay } from "../../lib/engine";
import { MAX_NAME_LENGTH } from "../../lib/protocol";
import type { StoredPlayer, Conn } from "./state";
import type { RoomServer } from "../server";

/** A name as typed, tidied; null (and an error) when it's empty or too long. */
export function cleanName(room: RoomServer, conn: Conn, input: unknown): string | null {
  const name = typeof input === "string" ? input.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > MAX_NAME_LENGTH) {
    room.send(conn, { type: "error", code: "invalid-name" });
    return null;
  }
  return name;
}

export function validateName(room: RoomServer, conn: Conn, input: unknown, selfId?: string): string | null {
  const name = cleanName(room, conn, input);
  if (!name) return null;
  if (!isNameFree(room, name, selfId)) {
    room.send(conn, { type: "error", code: "name-taken" });
    return null;
  }
  return name;
}

export function isNameFree(room: RoomServer, name: string, selfId?: string) {
  return !room.state!.players.some((p) => p.id !== selfId && p.name.toLowerCase() === name.toLowerCase());
}

/** "Name 2", "Name 3"… the first one nobody else uses. */
export function uniqueName(room: RoomServer, base: string, selfId?: string) {
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const name = base.slice(0, MAX_NAME_LENGTH - suffix.length) + suffix;
    if (isNameFree(room, name, selfId)) return name;
  }
}

/**
 * The name an account gets. Accounts have priority: a player without one
 * who uses that name is renamed (and can pick another). If another account
 * already has it, this one gets a number instead.
 */
export function claimName(room: RoomServer, wanted: string, selfId?: string, username?: string | null) {
  const same = (name: string | undefined) => name?.toLowerCase() === wanted.toLowerCase();
  const others = room.state!.players.filter((p) => p.id !== selfId);
  // Accounts with the same first name: each shows its username, "Ylya (hy13)".
  const namesakes = others.filter((p) => p.sub && !p.showUsername && (same(p.accountName) || same(p.name)));
  if (namesakes.length > 0) {
    for (const p of namesakes) {
      const named = p.username && withUsername(room, wanted, p.username, p.id);
      if (named && named !== p.name) renamePlayer(room, p, named);
    }
    return (username && withUsername(room, wanted, username, selfId)) || uniqueName(room, wanted, selfId);
  }
  // A guest using the name gives it up, and is told; an account (by its username) keeps it.
  const holder = others.find((p) => same(p.name));
  if (!holder) return wanted;
  if (holder.sub) return uniqueName(room, wanted, selfId);
  renamePlayer(room, holder, uniqueName(room, wanted, holder.id));
  holder.renamed = true;
  return wanted;
}

/**
 * The name an account plays under: its username when the player chose it
 * (unique, so nothing to tell apart), its first name otherwise.
 */
export function claimAccountName(
    room: RoomServer,
  { accountName, username, showUsername }: Pick<StoredPlayer, "username" | "showUsername"> & { accountName: string },
  selfId?: string,
) {
  if (showUsername && username) return claimName(room, username.slice(0, MAX_NAME_LENGTH), selfId);
  return claimName(room, accountName, selfId, username);
}

/** An account told apart from a namesake who now plays under their username gets its plain first name back. */
export function untangleNames(room: RoomServer, accountName: string) {
  const same = (name?: string) => name?.toLowerCase() === accountName.toLowerCase();
  const namesakes = room.state!.players.filter((p) => p.sub && !p.showUsername && same(p.accountName));
  const [only] = namesakes;
  if (namesakes.length === 1 && only.name !== accountName && isNameFree(room, accountName, only.id)) {
    renamePlayer(room, only, accountName);
  }
}

/** "Ylya (hy13)", if it fits and nobody else has it. */
export function withUsername(room: RoomServer, name: string, username: string, selfId?: string) {
  const named = `${name} (${username})`;
  return named.length <= MAX_NAME_LENGTH && isNameFree(room, named, selfId) ? named : null;
}

/** Names are part of the game setup too, so the game screen follows. */
export function renamePlayer(room: RoomServer, player: StoredPlayer, name: string) {
  player.name = name;
  for (const game of [room.state!.game, room.state!.endedGame]) {
    const entry = game?.setup.players.find((p) => p.id === player.id);
    if (entry) entry.name = name;
  }
  if (room.state!.game) room.game = replay(room.state!.game.setup, room.state!.game.log);
}
