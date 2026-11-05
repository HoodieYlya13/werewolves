import { roles } from "./roles";
import { EngineError, type GameEvent, type GameSetup, type GameState, type PhaseRef, type Player, type RoleId, type Team } from "./types";

export const alive = (state: GameState) => state.players.filter((p) => p.alive);

/** The night's first step: the game master opens it with the village falling asleep. */
export function nightFalls(state: GameState) {
  return state.phase.kind === "night" && state.phaseStep === 0 && state.step.kind !== "prologue" && state.step.kind !== "phase-end";
}

/**
 * The game master reads a line of their own before this step (the last turn's
 * "go back to sleep", or night falling): phones wait for it to be read.
 */
export function hasLeadLine(state: GameState) {
  return !!state.backToSleep || nightFalls(state);
}

/** With the Angel and the opening-vote rule, the game opens with a vote (day 0) before night 1. */
export function opensWithVote(setup: GameSetup) {
  return Object.values(setup.roles).includes("angel") && setup.settings.angelRule !== "first-vote";
}

/**
 * Days begun by the end of `phase`, the opening day 0 included: how long a
 * game lasted, or how long a player lived in it. Dying in the night misses
 * the next day; dying by day (a vote, the Hunter) still counts that day.
 */
export function daysBy(setup: GameSetup, phase: PhaseRef) {
  const lastDay = phase.kind === "day" ? phase.number : phase.number - 1;
  return Math.max(0, lastDay - (opensWithVote(setup) ? 0 : 1) + 1);
}

/** Phases in play order: night N, then day N. */
const phaseOrder = (phase: PhaseRef) => phase.number * 2 + (phase.kind === "day" ? 1 : 0);

/** The role that deals each kind of death a player can be blamed for. */
const KILLER_ROLES: Partial<Record<string, RoleId>> = { poison: "witch", hunter: "hunter", "white-werewolf": "white-werewolf", rust: "knight" };

/**
 * Who killed a dead player, for head-to-head stats: the wolves still in the
 * pack that night, the Witch who poisoned, the Hunter who shot, and so on.
 * Votes, the Scapegoat and grief have no one to blame: none.
 */
export function killersOf(state: GameState, victim: Player): string[] {
  const death = victim.death;
  if (!death) return [];
  if (death.cause === "wolves") {
    // Still alive when the pack chose (a wolf who dies the same night still hunted).
    return state.players.filter((p) => p.id !== victim.id && isWolf(p) && (!p.death || phaseOrder(p.death.phase) >= phaseOrder(death.phase))).map((p) => p.id);
  }
  const role = KILLER_ROLES[death.cause];
  return role ? state.players.filter((p) => p.id !== victim.id && p.role === role).map((p) => p.id) : [];
}

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

/** The living Wild Child who picked this player as their role model, if any. */
export function wildChildOf(state: GameState, playerId: string) {
  return state.players.find((p) => p.alive && p.role === "wild-child" && p.memo.model === playerId) ?? null;
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

/**
 * The Elder killed in plain sight (the vote, the Hunter's shot) among these
 * deaths: the village must hear it lost its powers. A poisoned Elder keeps the
 * mystery: the village finds out when its roles stop being called at night.
 */
export function elderCostsPowers(state: GameState, deaths: { playerId: string; cause: string }[]) {
  return state.villagePowersLost && deaths.some((d) => (d.cause === "vote" || d.cause === "hunter") && getPlayer(state, d.playerId).role === "elder");
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
