import { alive, baseTeam } from "./helpers";
import type { DeathCause, GameState, Player, Team, Winner } from "./types";

const ANGEL_WIN_CAUSES: DeathCause[] = ["vote", "wolves", "poison"];

/**
 * Whether the Angel's early death wins them the game. Dying of love or from
 * the Hunter's shot never counts.
 */
function angelWins(state: GameState, angel: Player) {
  const death = angel.death;
  if (!death) return false;
  if (state.setup.settings.angelRule === "first-vote") {
    return death.cause === "vote" && death.phase.kind === "day" && death.phase.number === 1;
  }
  const firstTurn = death.phase.number === 0 || (death.phase.kind === "night" && death.phase.number === 1);
  return firstTurn && ANGEL_WIN_CAUSES.includes(death.cause);
}

function isMixedCouple(state: GameState) {
  if (!state.lovers) return false;
  const [a, b] = state.lovers.map((id) => state.players.find((p) => p.id === id)!);
  return baseTeam(a) !== baseTeam(b);
}

/** The team a player currently wins with. */
export function teamOf(state: GameState, player: Player): Team {
  if (state.lovers?.includes(player.id) && isMixedCouple(state)) return "lovers";
  return baseTeam(player);
}

/**
 * Solo goals are checked first (Angel, Pied Piper, Abominable Sectarian).
 * Otherwise a team wins when every living player belongs to it: that covers
 * the village, the wolves, mixed lovers and the White Werewolf with one rule.
 */
export function getWinner(state: GameState): Winner | null {
  const living = alive(state);
  if (living.length === 0) return { team: null, playerIds: [] };

  const angel = state.players.find((p) => p.role === "angel" && angelWins(state, p));
  if (angel) return { team: "angel", playerIds: [angel.id] };

  const piper = living.find((p) => p.role === "pied-piper");
  if (piper && living.every((p) => p.id === piper.id || p.flags.charmed)) {
    return { team: "piper", playerIds: [piper.id] };
  }

  const sectarian = living.find((p) => p.role === "abominable-sectarian");
  const groups = state.setup.groups;
  if (sectarian && groups?.[sectarian.id] && living.every((p) => groups[p.id] === groups[sectarian.id])) {
    return { team: "sectarian", playerIds: [sectarian.id] };
  }

  const teams = new Set(living.map((p) => teamOf(state, p)));
  let team: Team | null = teams.size === 1 ? [...teams][0] : null;

  if (!team && state.setup.settings.wolvesWinAtParity && [...teams].every((t) => t === "village" || t === "wolves")) {
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
