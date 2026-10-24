import { roles } from "./roles";
import { EngineError, type GameEvent, type GameState, type Player, type RoleId, type Team } from "./types";

export const alive = (state: GameState) => state.players.filter((p) => p.alive);

export function getPlayer(state: GameState, id: string) {
  const player = state.players.find((p) => p.id === id);
  if (!player) throw new EngineError("invalid-target", `Unknown player ${id}`);
  return player;
}

export function getAlive(state: GameState, id: string) {
  const player = getPlayer(state, id);
  if (!player.alive) throw new EngineError("invalid-target", `${player.name} is dead`);
  return player;
}

/** Team before love gets involved: the card's team, unless they turned into a wolf. */
export function baseTeam(player: Player): Team {
  if (player.flags.infected || player.flags["turned-wolf"]) return "wolves";
  return roles[player.role].team;
}

/** Wakes with the pack, and makes the Bear growl and the Fox sniff. */
export function isWolf(player: Player) {
  return baseTeam(player) === "wolves" || player.role === "white-werewolf";
}

/**
 * Whether a player can still use their role. Killing the Elder strips every
 * villager of their power; the Fox loses his after a wrong guess.
 */
export function hasPower(state: GameState, player: Player) {
  if (state.villagePowersLost && roles[player.role].team === "village") return false;
  if (player.role === "fox" && player.flags["fox-powerless"]) return false;
  return true;
}

/** Living holders of a role who can still use it, in seating order. */
export function holders(state: GameState, role: RoleId) {
  return state.players.filter((p) => p.alive && p.role === role && hasPower(state, p));
}

/**
 * The closest living players on each side. Seats run clockwise, so when you
 * face the table the next seat is on your left.
 */
export function livingNeighbours(state: GameState, player: Player): { left: Player; right: Player } | null {
  const ring = state.players.filter((p) => p.alive || p.id === player.id);
  const i = ring.findIndex((p) => p.id === player.id);
  const others = ring.length - 1;
  if (others < 1) return null;
  const left = ring[(i + 1) % ring.length];
  const right = ring[(i - 1 + ring.length) % ring.length];
  return { left, right };
}

/** The first wolf to a player's left, going round the table. */
export function firstWolfToLeft(state: GameState, player: Player) {
  const ring = state.players;
  const i = ring.findIndex((p) => p.id === player.id);
  for (let step = 1; step < ring.length; step++) {
    const p = ring[(i + step) % ring.length];
    if (p.alive && isWolf(p)) return p;
  }
  return null;
}

export function log(state: GameState, event: GameEvent) {
  state.events.push({ ...event, phase: { ...state.phase } });
}
