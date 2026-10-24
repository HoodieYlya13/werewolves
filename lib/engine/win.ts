import { alive, roles } from "./roles";
import type { GameState, Player, Team, Winner } from "./types";

function isMixedCouple(state: GameState) {
  if (!state.lovers) return false;
  const [a, b] = state.lovers.map((id) => state.players.find((p) => p.id === id)!);
  return roles[a.role].team !== roles[b.role].team;
}

/** The team a player currently wins with. */
export function teamOf(state: GameState, player: Player): Team {
  if (state.lovers?.includes(player.id) && isMixedCouple(state)) return "lovers";
  return roles[player.role].team;
}

/**
 * A team wins when every living player belongs to it. That covers the village
 * (all wolves dead), the wolves (everyone else dead) and mixed lovers (last two
 * standing) with one rule.
 */
export function getWinner(state: GameState): Winner | null {
  const living = alive(state);
  if (living.length === 0) return { team: null, playerIds: [] };

  const teams = new Set(living.map((p) => teamOf(state, p)));
  let team: Team | null = teams.size === 1 ? [...teams][0] : null;

  if (!team && state.setup.settings.wolvesWinAtParity && !teams.has("lovers")) {
    const wolves = living.filter((p) => teamOf(state, p) === "wolves").length;
    if (wolves > 0 && wolves >= living.length - wolves) team = "wolves";
  }

  if (!team) return null;
  return { team, playerIds: state.players.filter((p) => teamOf(state, p) === team).map((p) => p.id) };
}

/** Teams that still have living players, i.e. who can still win. */
export function remainingTeams(state: GameState): Team[] {
  return [...new Set(alive(state).map((p) => teamOf(state, p)))];
}
